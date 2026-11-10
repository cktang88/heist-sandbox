import { Color, PointLight, SpotLight, type Group } from 'three'
import type { Lamp } from '../../game/site'
import type { Vec } from '../../game/types'
import type { World } from '../../game/world'
import { DRAW_DISTANCE } from '../layer'
import { Beam } from './beams'
import { isAlarmBeacon, lampBrightness } from './brightness'
import { ALARM_WASH_GROW, FIXTURE_SPECS } from './fixtureSpecs'
import { Halos } from './halos'
import { lampGridFor } from './lampGrid'
import { SlotPool } from './slotPool'
import { WashBounds } from './washes'

/**
 * Real lights for lamps. Budget, for a mid laptop GPU in forward shading (docs/research/rendering.md, 2.2):
 * 4 spots for ceiling and outdoor fittings, 1 of them with a (small, cached) shadow map, and 3 short-range points for small
 * lamps, handed to the lamps that matter most near the player.
 * Lamp shadow maps are drawn once when a light moves to a lamp, then reused; they are redrawn only while someone
 * moves in that light or the level changes shape, at most one a frame.
 */
export const SHADOW_SPOTS = 1
export const PLAIN_SPOTS = 3
export const LAMP_POINTS = 3
const SHADOW_SIZE = 512
const MAX_SHADOW_REFRESHES = 1

/** Lamps this far from the view centre can still get a real light (they light the screen edge), in tiles. */
const LIGHT_RANGE_X = 30
const LIGHT_RANGE_Y = 19
/** Half the size of what is on screen, in tiles. */
const SCREEN_X = 23
const SCREEN_Y = 13
/** The most lamps considered near the view at once. */
const MAX_NEAR = 512
/** Halos are drawn just in front of the back wall. */
const WALL_GLOW_Z = -2.34
/** Wall fittings shine from at least this far in front of the wall, so it gets a pool rather than a hot spot. */
const WALL_LIGHT_Z = -2.0

export type LampLights = { update(world: World, view: Vec, dt: number, alarm: boolean, outdoorGlow: number): void }

function lampSpot(shadowed: boolean): SpotLight {
  const light = new SpotLight(0xffffff, 0, 10, 1, 0.8, 1.3)
  if (!shadowed) return light
  light.castShadow = true
  light.shadow.mapSize.set(SHADOW_SIZE, SHADOW_SIZE)
  light.shadow.bias = -0.0015
  light.shadow.normalBias = 0.03
  light.shadow.camera.near = 0.2
  light.shadow.autoUpdate = false
  // The map only exists once drawn, and a material sampling a missing shadow map is a GL error.
  light.shadow.needsUpdate = true
  return light
}

/** Lamp data that only depends on the lamp list, worked out once per site. */
class SiteLamps {
  readonly linear: Float32Array
  /** Inside a room or underground: such a lamp has a wall behind it to catch a pool, and is not lost in daylight. */
  readonly indoor: Uint8Array
  readonly washes: WashBounds
  /** This frame's brightness of each lamp near the view, and how much real light it holds (0..1). */
  readonly level: Float32Array
  readonly held: Float32Array
  readonly shadowPool: SlotPool
  readonly spotPool: SlotPool
  readonly pointPool: SlotPool

  constructor(world: World, readonly lamps: readonly Lamp[]) {
    const color = new Color()
    this.linear = new Float32Array(lamps.length * 3)
    lamps.forEach((lamp, index) => {
      color.setHex(lamp.color)
      this.linear.set([color.r, color.g, color.b], index * 3)
    })
    this.indoor = Uint8Array.from(lamps, (lamp) => world.interiors.some((area) => lamp.x >= area.x && lamp.x <= area.x + area.w && lamp.y >= area.y && lamp.y <= area.y + area.h) ? 1 : 0)
    this.washes = new WashBounds(lamps)
    this.level = new Float32Array(lamps.length)
    this.held = new Float32Array(lamps.length)
    this.shadowPool = new SlotPool(SHADOW_SPOTS, lamps.length)
    this.spotPool = new SlotPool(PLAIN_SPOTS, lamps.length)
    this.pointPool = new SlotPool(LAMP_POINTS, lamps.length)
  }
}

/** How much a lamp deserves a real light: bright, near the middle of the view and the player, and on screen. */
function importance(lamp: Lamp, view: Vec, playerX: number, playerY: number, alarm: boolean): number {
  const dx = lamp.x - view.x
  const dy = (lamp.y - view.y) * 1.3
  let score = (lamp.strength * (0.6 + Math.min(lamp.radius, 12) / 12)) / (1 + (dx * dx + dy * dy) / 150)
  if (Math.abs(dx) > SCREEN_X || Math.abs(lamp.y - view.y) > SCREEN_Y) score *= 0.35
  const toPlayer = Math.hypot(lamp.x - playerX, lamp.y - playerY)
  if (toPlayer < lamp.radius) score *= 1.6 - (0.6 * toPlayer) / lamp.radius
  if (isAlarmBeacon(lamp, alarm)) score *= 2.5
  return score
}

function inLightRange(lamp: Lamp, view: Vec): boolean {
  return Math.abs(lamp.x - view.x) <= LIGHT_RANGE_X && Math.abs(lamp.y - view.y) <= LIGHT_RANGE_Y
}

export function createLampLights(group: Group): LampLights {
  const shadowSpots = Array.from({ length: SHADOW_SPOTS }, () => lampSpot(true))
  const plainSpots = Array.from({ length: PLAIN_SPOTS }, () => lampSpot(false))
  const spots = [...shadowSpots, ...plainSpots]
  const points = Array.from({ length: LAMP_POINTS }, () => new PointLight(0xffffff, 0, 6, 1.6))
  const beams = spots.map(() => new Beam())
  const halos = new Halos(MAX_NEAR * 2)
  for (const light of spots) group.add(light, light.target)
  group.add(...points, ...beams.map((beam) => beam.mesh), halos.mesh)

  // Reused every frame, so the frame loop allocates nothing.
  const near = new Int32Array(MAX_NEAR)
  const tint = new Color()
  const shadowStale = new Uint8Array(SHADOW_SPOTS)
  let site: SiteLamps | null = null
  let gridVersion = -1
  let shadowTurn = 0
  let refreshes = 0

  /** Offers every lit lamp in range to the pool for its kind of light. Spots that miss a shadowed light try the plain ones. */
  function assign(world: World, view: Vec, count: number, dt: number, alarm: boolean): void {
    const s = site!
    const playerX = world.player.x + world.player.w / 2
    const playerY = world.player.y + world.player.h / 2
    s.shadowPool.begin()
    s.spotPool.begin()
    s.pointPool.begin()
    for (let at = 0; at < count; at += 1) {
      const index = near[at]
      const lamp = s.lamps[index]
      if (s.level[index] <= 0 || !inLightRange(lamp, view)) continue
      const pool = FIXTURE_SPECS[lamp.fixture].light === 'point' ? s.pointPool : s.shadowPool
      pool.offer(index, importance(lamp, view, playerX, playerY, alarm))
    }
    s.shadowPool.settle(dt)
    for (let at = 0; at < count; at += 1) {
      const index = near[at]
      const lamp = s.lamps[index]
      if (s.level[index] <= 0 || FIXTURE_SPECS[lamp.fixture].light !== 'spot' || s.shadowPool.holds(index) || !inLightRange(lamp, view)) continue
      s.spotPool.offer(index, importance(lamp, view, playerX, playerY, alarm))
    }
    s.spotPool.settle(dt)
    s.pointPool.settle(dt)
    noteHeld(s.shadowPool)
    noteHeld(s.spotPool)
    noteHeld(s.pointPool)
  }

  function noteHeld(pool: SlotPool): void {
    for (let slot = 0; slot < pool.size; slot += 1) {
      const lamp = pool.lamp[slot]
      if (lamp >= 0) site!.held[lamp] = Math.max(site!.held[lamp], pool.weight[slot])
    }
  }

  function driveSpot(light: SpotLight, beam: Beam, lampIndex: number, weight: number, outdoorGlow: number): void {
    if (lampIndex < 0) {
      light.intensity = 0
      beam.hide()
      return
    }
    const s = site!
    const lamp = s.lamps[lampIndex]
    const spec = FIXTURE_SPECS[lamp.fixture]
    const level = s.level[lampIndex]
    const x = lamp.x
    const y = -lamp.y + spec.lightY
    light.color.setHex(lamp.color)
    light.intensity = spec.intensity * lamp.strength * level * weight
    light.distance = Math.min(spec.maxReach, lamp.radius * spec.reach) + 2
    light.angle = spec.angle
    light.penumbra = spec.penumbra
    light.position.set(x, y, spec.z)
    light.target.position.set(x, -lamp.y + spec.aimY, spec.aimZ)
    light.target.updateMatrixWorld()
    light.shadow.camera.far = light.distance
    // A beam reaches the floor under a ceiling fitting; a floodlight's reaches out across the yard.
    const drop = s.washes.rect[lampIndex * 4 + 3] - lamp.y
    const length = spec.aimZ > 0 ? spec.maxReach * 0.55 : Math.max(1, Math.min(drop, light.distance))
    tint.setRGB(s.linear[lampIndex * 3], s.linear[lampIndex * 3 + 1], s.linear[lampIndex * 3 + 2])
    const glow = s.indoor[lampIndex] ? 1 : outdoorGlow
    beam.show(x, y, spec.z, x, -lamp.y + spec.aimY, spec.aimZ, length, spec.angle * 0.62, tint, 0.032 * spec.beam * level * weight * glow)
  }

  function drivePoint(light: PointLight, lampIndex: number, weight: number): void {
    if (lampIndex < 0) {
      light.intensity = 0
      return
    }
    const lamp = site!.lamps[lampIndex]
    const spec = FIXTURE_SPECS[lamp.fixture]
    light.color.setHex(lamp.color)
    light.intensity = spec.intensity * lamp.strength * site!.level[lampIndex] * weight
    light.distance = Math.min(spec.maxReach, lamp.radius * spec.reach + 1)
    light.position.set(lamp.x, -lamp.y + spec.lightY, Math.max(spec.z + 0.1, WALL_LIGHT_Z))
  }

  /**
   * Shadow maps are only redrawn when they would be wrong: a new lamp or a changed level. People do not draw into
   * them (they leave a soft patch on the floor instead), so someone walking under a lamp costs no redraw.
   */
  function refreshShadows(world: World): void {
    const pool = site!.shadowPool
    if (world.grid.version !== gridVersion) {
      gridVersion = world.grid.version
      shadowStale.fill(1)
    }
    refreshes = 0
    for (let slot = 0; slot < SHADOW_SPOTS; slot += 1) {
      if (!pool.moved[slot] || pool.lamp[slot] < 0) continue
      shadowSpots[slot].shadow.needsUpdate = true
      shadowStale[slot] = 0
      refreshes += 1
    }
    // Take turns, so with more than two lights wanting a redraw none of them is starved.
    shadowTurn = (shadowTurn + 1) % SHADOW_SPOTS
    for (let turn = 0; turn < SHADOW_SPOTS && refreshes < MAX_SHADOW_REFRESHES; turn += 1) {
      const slot = (shadowTurn + turn) % SHADOW_SPOTS
      const lampIndex = pool.lamp[slot]
      if (lampIndex < 0 || shadowSpots[slot].shadow.needsUpdate) continue
      if (!shadowStale[slot]) continue
      shadowSpots[slot].shadow.needsUpdate = true
      shadowStale[slot] = 0
      refreshes += 1
    }
  }

  /** Paints a wall wash and a bulb haze for every lit fitting near the view, so no glowing bulb lights nothing. */
  function paintHalos(count: number, outdoorGlow: number, alarm: boolean): void {
    const { lamps, linear, indoor, held, level, washes } = site!
    const rect = washes.rect
    halos.begin()
    for (let at = 0; at < count; at += 1) {
      const index = near[at]
      if (level[index] <= 0) continue
      const lamp = lamps[index]
      const spec = FIXTURE_SPECS[lamp.fixture]
      const red = linear[index * 3]
      const green = linear[index * 3 + 1]
      const blue = linear[index * 3 + 2]
      if (indoor[index]) {
        // A real light already paints its own pool, so the fake one only tops it up. Outdoors there is no wall to catch one.
        const grow = isAlarmBeacon(lamp, alarm) ? ALARM_WASH_GROW : 1
        const wash = spec.wash * Math.sqrt(lamp.strength) * level[index] * (1 - 0.6 * held[index]) * grow
        const r = index * 4
        halos.add(rect[r], -rect[r + 3], rect[r + 2], -rect[r + 1], WALL_GLOW_Z, lamp.x, -(lamp.y + spec.washDrop), (spec.washSize * grow) / 2, spec.washTall * grow, red * wash, green * wash, blue * wash)
      }
      const glare = spec.glare * level[index] * (indoor[index] ? 1 : outdoorGlow)
      const bulbY = -lamp.y + spec.lightY
      const half = spec.glareSize / 2
      halos.add(lamp.x - half, bulbY - half, lamp.x + half, bulbY + half, spec.z + 0.2, lamp.x, bulbY, half, half, red * glare, green * glare, blue * glare)
    }
    halos.end()
  }

  return {
    update(world, view, dt, alarm, outdoorGlow) {
      if (!site || site.lamps !== world.lamps) site = new SiteLamps(world, world.lamps)
      const halfW = DRAW_DISTANCE + 4
      const halfH = DRAW_DISTANCE * 0.62 + 4
      const count = lampGridFor(world.lamps).query(view.x - halfW, view.y - halfH, view.x + halfW, view.y + halfH, near)
      for (let at = 0; at < count; at += 1) {
        const index = near[at]
        site.level[index] = lampBrightness(world, site.lamps[index], index, alarm)
        site.held[index] = 0
        site.washes.ensure(world.grid, index)
      }
      assign(world, view, count, dt, alarm)
      for (let slot = 0; slot < SHADOW_SPOTS; slot += 1) driveSpot(shadowSpots[slot], beams[slot], site.shadowPool.lamp[slot], site.shadowPool.weight[slot], outdoorGlow)
      for (let slot = 0; slot < PLAIN_SPOTS; slot += 1) driveSpot(plainSpots[slot], beams[SHADOW_SPOTS + slot], site.spotPool.lamp[slot], site.spotPool.weight[slot], outdoorGlow)
      for (let slot = 0; slot < LAMP_POINTS; slot += 1) drivePoint(points[slot], site.pointPool.lamp[slot], site.pointPool.weight[slot])
      refreshShadows(world)
      paintHalos(count, outdoorGlow, alarm)
    },
  }
}
