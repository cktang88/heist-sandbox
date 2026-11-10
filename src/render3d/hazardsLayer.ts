import { Group } from 'three'
import type { Flash } from '../game/effects'
import { fireCells, flashViews, grenadeViews, smokeCells, sprayViews } from '../game/hazards/hazards'
import { lightLevelAt } from '../game/light'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { createFire, MAX_FLAMES } from './hazardfx/fire'
import { createGrenades } from './hazardfx/grenades'
import { nearestCells } from './hazardfx/quads'
import { createScorch } from './hazardfx/scorch'
import { createSmoke, MAX_SMOKE_QUADS } from './hazardfx/smoke'
import { createSprays } from './hazardfx/sprays'
import { DRAW_DISTANCE, type LayerFactory } from './layer'

/** Burning tiles drawn at once; each gets up to three flames. */
const MAX_FIRE_CELLS = Math.floor(MAX_FLAMES / 3)
const MAX_SMOKE_CELLS = Math.floor(MAX_SMOKE_QUADS / 3)
/** Smoke and fire just off screen still matter: a cloud drifting in should already be there. */
const REACH = { x: DRAW_DISTANCE * 0.75, y: DRAW_DISTANCE * 0.5 }
/** How often a smoky tile re-reads the room's light, and how many tiles may do so per frame. */
const LIGHT_REFRESH_SECONDS = 0.75
const LIGHT_READS_PER_FRAME = 40

/** Remembers how lit each smoky tile is, so smoke darkens with the room without re-tracing every lamp each frame. */
function createLightCache(world: World): { begin(clock: number): void; at(spot: Vec): number } {
  const cache = new Map<number, { level: number; stamp: number }>()
  let clock = 0
  let reads = 0
  return {
    begin(now) {
      clock = now
      reads = 0
      if (cache.size > 4000) cache.clear()
    },
    at(spot) {
      const key = Math.floor(spot.y) * world.grid.width + Math.floor(spot.x)
      const known = cache.get(key)
      if (known && (clock - known.stamp < LIGHT_REFRESH_SECONDS || reads >= LIGHT_READS_PER_FRAME)) return known.level
      if (!known && reads >= LIGHT_READS_PER_FRAME) return 0.4
      reads += 1
      const level = lightLevelAt(world, spot)
      cache.set(key, { level, stamp: clock })
      return level
    },
  }
}

/** Fire, smoke, sprays, grenades, flashbang pops and the soot they leave behind. */
export const createHazardsLayer: LayerFactory = (world) => {
  const group = new Group()
  const fire = createFire()
  const smoke = createSmoke()
  const sprays = createSprays()
  const grenades = createGrenades()
  const scorch = createScorch()
  group.add(scorch.group, fire.group, smoke.pool.mesh, sprays.pool.mesh, grenades.group)
  const light = createLightCache(world)
  const firePicked: number[] = []
  const smokePicked: number[] = []
  const blasts = new WeakSet<Flash>()

  return {
    group,
    update(now, frame) {
      const time = now.clock
      const flames = fireCells(now)
      nearestCells(flames, frame.view, REACH, MAX_FIRE_CELLS, firePicked)
      fire.update(flames, firePicked, time)
      for (const index of firePicked) {
        if (flames[index].intensity > 0.25) scorch.burn(now, flames[index].x + 0.5, flames[index].y + 0.5, 1.5 + flames[index].intensity)
      }
      for (const flash of now.effects.flashes) {
        if (flash.kind !== 'explosion' || blasts.has(flash)) continue
        blasts.add(flash)
        scorch.burn(now, flash.x, flash.y, Math.min(2.5, 1 + flash.radius * 0.4))
      }

      const clouds = smokeCells(now)
      nearestCells(clouds, frame.view, REACH, MAX_SMOKE_CELLS, smokePicked)
      light.begin(time)
      smoke.update(clouds, smokePicked, flames, firePicked, light.at, time)
      sprays.update(sprayViews(now), time)
      grenades.update(grenadeViews(now), flashViews(now), time)
    },
  }
}
