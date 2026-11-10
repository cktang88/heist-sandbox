import { Group, Mesh, type ShaderMaterial, type Texture } from 'three'
import { guardMood, type Guard } from '../game/guards'
import type { TileKind } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { guardMotion, playerMotion } from '../render/human/motion'
import { chargePose } from './chargePose'
import { runBuildJobs } from './core/buildQueue'
import { lastFrameMs, noteFramePart } from './core/frameProbe'
import { createGpuProbe, releaseTexture, texturesOf, uploadSpread } from './core/gpu'
import { measured } from './core/timing'
import { createEffects3d } from './fx3d'
import { BACK, FRONT, type SurfaceMaterials, type SurfaceName } from './levelMesh'
import { MeshBuilder } from './meshBuilder'
import type { FallingTile } from '../game/collapse'
import { Figure, outfitFor, weaponFor } from './people3d'
import { BOX, buildDrone, buildLoot, buildParachute, buildPickup, buildVan, CHARGE_LIGHT, CHARGE_MATERIAL } from './props3d'
import { createDevicesLayer } from './devicesLayer'
import { createFixturesLayer } from './fixturesLayer'
import { depthOffsetFor } from '../game/gaps/gaps'
import { createGapsLayer } from './gapsLayer'
import { createGrappleLayer } from './grappleLayer'
import { createSystemsLayer } from './systemsLayer'
import { createHazardsLayer } from './hazardsLayer'
import { createSandboxLayer } from './sandboxLayer'
import { DRAW_DISTANCE, type Layer, type LayerFactory } from './layer'
import { createPropsLayer } from './propsLayer'
import { createRoomsLayer } from './roomsLayer'
import { createStructureLayer } from './structureLayer'

/** Everything that moves or can be picked up: people, props, shots and effects. */
export type Actors = {
  group: Group
  /** Sets up the next layer; true once all are set up. Spread over frames, so starting a level never freezes the page for long. */
  buildNext(): boolean
  update(world: World, aim: Vec, view: Vec): void
  dispose(): void
}

/** The build queue works toward where the view will be this far ahead, in seconds, capped at `LEAD_REACH` tiles. */
const LEAD_SECONDS = 0.8
const LEAD_REACH = 40

function leadOf(world: World, view: Vec): Vec {
  const body = world.drone ?? world.player
  const ahead = (speed: number) => Math.max(-LEAD_REACH, Math.min(LEAD_REACH, speed * LEAD_SECONDS))
  return { x: view.x + ahead(body.vx), y: view.y + ahead(body.vy) }
}

/** The gold case's model size (see `buildLoot`), and how much smaller it is drawn strapped to the player's back. */
const CASE_SIZE = { w: 0.8, h: 0.6 }
const CARRIED_CASE = 0.6

/** People on a staircase are drawn further back, on the stairs behind the walking lane. */
const STAIR_LANE = -1.5

/** A tile-sized piece of wall, a hair smaller than its cell so a falling stack shows its cracks, textured like the level. */
const FALLING_SHRINK = 0.96
const FALLING_BLOCK = (() => {
  const block = new MeshBuilder()
  const [half, depth] = [FALLING_SHRINK / 2, (FRONT - BACK) / 2 - 0.02]
  block.box(-half, -half, -depth, half, half, depth, 0.5, 0.82)
  return block.build()
})()

const FALLING_SURFACE: Partial<Record<TileKind, SurfaceName>> = {
  dirt: 'dirt', brick: 'brick', concrete: 'concrete', steel: 'steel', wood: 'wood', door: 'door', glass: 'glass',
}

export function createActors(world: World, materials: SurfaceMaterials): Actors {
  const group = new Group()
  const effects = createEffects3d()
  group.add(effects.group, createGpuProbe())
  // Each layer owns one slice of the scene. They are independent, so they can be worked on separately.
  const factories: [string, LayerFactory][] = [
    ['rooms', createRoomsLayer], ['props', createPropsLayer], ['fixtures', createFixturesLayer], ['devices', createDevicesLayer],
    ['structure', createStructureLayer], ['hazards', createHazardsLayer], ['sandbox', createSandboxLayer], ['gaps', createGapsLayer],
    ['grapple', createGrappleLayer],
    ['systems', createSystemsLayer],
  ]
  // Each layer's set-up and per-frame time is measured, for the `?debug=1` readout (User Timing and the frame probe).
  const layers: { name: string; layer: Layer }[] = []

  const operative = new Figure('operative')
  // In a stolen uniform the player is drawn as a guard: a second figure, swapped in while the disguise is on.
  // An officer's uniform looks like an officer's, any other like a patrolman's (the game only tells the two apart).
  const disguised = new Figure(outfitFor('patrol', false))
  const disguisedOfficer = new Figure(outfitFor('officer', false))
  const parachute = buildParachute()
  group.add(operative.group, disguised.group, disguisedOfficer.group, parachute)
  const guards = new Map<Guard, Figure>()

  const van = buildVan()
  const flipped = world.extraction.x > world.grid.width / 2
  van.position.set(world.extraction.x + (flipped ? 7.2 : 0.8), -(world.extraction.y + world.extraction.h), 0)
  if (flipped) van.scale.x = -1
  const loot = buildLoot()
  const pickups = world.pickups.map((pickup) => ({ pickup, model: buildPickup(pickup.kind) }))
  const drone = buildDrone()
  group.add(van, loot, drone, ...pickups.map((entry) => entry.model))

  // Small pools for things that come and go: C4 blocks and falling chunks of wall.
  const charges = Array.from({ length: 24 }, () => {
    const block = new Mesh(BOX, CHARGE_MATERIAL)
    const light = new Mesh(BOX, CHARGE_LIGHT)
    block.castShadow = true
    group.add(block, light)
    return { block, light }
  })
  const falling: Mesh[] = []
  // Where each falling piece was last seen, so a piece that vanished (landed or broke up) leaves a puff of dust.
  let fallingSeen = new Map<FallingTile, Vec & { slab: boolean }>()
  let lastClock = world.clock

  return {
    group,
    buildNext() {
      const next = factories[layers.length]
      if (!next) return true
      const [name, create] = next
      const layer = measured(`build layer ${name}`, () => create(world, materials))
      layers.push({ name: `layer ${name}`, layer })
      // Named so the `?debug=1` draw-call breakdown can say which layer a draw belongs to.
      layer.group.name = name
      group.add(layer.group)
      // What the layer built at once goes to the GPU over the coming frames, nearest the view first.
      uploadSpread(layer.group, `upload ${name}`)
      return layers.length === factories.length
    },
    update(now, aim, view) {
      const near = (x: number, y: number) => Math.abs(x - view.x) < DRAW_DISTANCE && Math.abs(y - view.y) < DRAW_DISTANCE * 0.62
      const hero = now.player
      const posed = playerMotion(now, aim)
      const disguise = now.stealth.disguise
      const player = disguise ? (disguise.officer ? disguisedOfficer : disguised) : operative
      for (const spare of [operative, disguised, disguisedOfficer]) if (spare !== player) spare.group.visible = false
      // Shut in a locker or under a desk the player is not drawn; the overlay marks where he is.
      player.group.visible = !hero.hidden
      const body = player.animate(posed.motion, posed.held)
      player.group.position.z = hero.stairs ? STAIR_LANE : depthOffsetFor(now, hero)
      parachute.visible = hero.chute
      parachute.position.set(body.shoulder.x, -body.shoulder.y, 0)

      for (const guard of now.guards) {
        let figure = guards.get(guard)
        // Only people near the view get a body; a big site has far more guards than fit on screen.
        // People away from the view leave the scene graph (hidden objects would still have their matrices updated).
        if (!near(guard.x, guard.y)) {
          if (figure) group.remove(figure.group)
          continue
        }
        if (!figure) {
          figure = new Figure(outfitFor(guard.role, guard.armored))
          guards.set(guard, figure)
        }
        if (!figure.group.parent) group.add(figure.group)
        // A body stuffed in a locker is out of sight.
        figure.group.visible = guard.hiddenIn === null
        figure.showDropped(guard.droppedWeapon, weaponFor(guard.role, guard.armored))
        const mood = guardMood(guard)
        if (mood === 'dead') {
          if (guard.ragdoll) figure.poseRagdoll(guard.ragdoll)
          continue
        }
        const weapon = weaponFor(guard.role, guard.armored, guard.state !== 'patrol')
        const posed = guardMotion(now, guard, weapon)
        figure.animate(posed.motion, posed.held, guard.hitFlash > 0)
        figure.group.position.z = guard.stairs ? STAIR_LANE : depthOffsetFor(now, guard)
      }


      // Once taken, the case rides on the player's back (as in the flat view) instead of vanishing.
      const carrying = hero.hasLoot && !hero.hidden
      loot.visible = !now.loot.taken || carrying
      if (carrying) {
        loot.scale.setScalar(CARRIED_CASE)
        loot.position.set(body.shoulder.x - hero.facing * 0.42 - CASE_SIZE.w * CARRIED_CASE / 2, -(body.shoulder.y + 0.05 + CASE_SIZE.h * CARRIED_CASE), player.group.position.z - 0.3)
      } else {
        loot.scale.setScalar(1)
        loot.position.set(now.loot.x, -(now.loot.y + now.loot.h), 0)
      }
      for (const { pickup, model } of pickups) {
        model.visible = !pickup.taken
        model.position.set(pickup.x, -(pickup.y + pickup.h), 0)
      }
      drone.visible = now.drone !== null
      if (now.drone) drone.position.set(now.drone.x + now.drone.w / 2, -(now.drone.y + now.drone.h / 2), 0.1)

      const blink = Math.floor(now.clock * 5) % 2 === 0
      charges.forEach(({ block, light }, index) => {
        const charge = now.charges[index]
        block.visible = Boolean(charge)
        light.visible = Boolean(charge) && blink
        if (!charge) return
        const pose = chargePose(charge)
        block.position.set(pose.x, pose.y, pose.z)
        block.scale.set(pose.sx, pose.sy, pose.sz)
        light.position.set(pose.light.x, pose.light.y, pose.light.z)
        light.scale.setScalar(0.08)
      })

      // A storey that comes loose falls as one slab: its tiles share a row and speed, and are drawn as one solid
      // piece (no cracks, no tipping). A lone piece shows its cracks and tips a little as it drops.
      const rows = new Set(now.falling.map((tile) => `${tile.x},${tile.y}`))
      const inSlab = (tile: FallingTile) => rows.has(`${tile.x - 1},${tile.y}`) || rows.has(`${tile.x + 1},${tile.y}`)
      const stillFalling = new Map<FallingTile, Vec & { slab: boolean }>()
      now.falling.forEach((tile, index) => {
        let mesh = falling[index]
        if (!mesh) {
          mesh = new Mesh(FALLING_BLOCK, materials.concrete)
          mesh.castShadow = true
          falling.push(mesh)
          group.add(mesh)
        }
        mesh.visible = true
        mesh.material = materials[FALLING_SURFACE[tile.kind] ?? 'concrete']
        const slab = inSlab(tile)
        // Kept slight because the piece snaps square again when it lands.
        const lean = slab ? 0 : (((tile.x * 7919) % 13) / 13 - 0.5) * 0.12 * Math.min(1, tile.vy / 12)
        mesh.position.set(tile.x + 0.5, -(tile.y + 0.5), (FRONT + BACK) / 2)
        mesh.rotation.set(lean * 0.4, 0, lean)
        mesh.scale.set(slab ? 1 / FALLING_SHRINK : 1, 1, 1)
        stillFalling.set(tile, { x: tile.x + 0.5, y: tile.y + 1, slab })
      })
      for (let index = now.falling.length; index < falling.length; index += 1) falling[index].visible = false
      // A landing slab raises one long cloud: a puff every few tiles along it, bigger than a lone piece's.
      for (const [tile, at] of fallingSeen) {
        if (stillFalling.has(tile)) continue
        if (!at.slab) effects.dust(at.x, at.y, 1)
        else if (tile.x % 3 === 0) effects.dust(at.x, at.y, 1.6)
      }
      fallingSeen = stillFalling

      const dt = Math.max(0, now.clock - lastClock)
      effects.update(now, dt)
      for (const { name, layer } of layers) {
        const start = performance.now()
        layer.update(now, { dt, view, aim })
        noteFramePart(name, performance.now() - start)
      }
      runBuildJobs(view, lastFrameMs(), leadOf(now, view))
      lastClock = now.clock
    },
    dispose() {
      // Each heist builds its own canvases (window atlas, signs, smoke puffs...). Free their GPU copies, or every new
      // heist keeps the last one's. Shared textures are simply sent again when the next heist draws with them.
      const seen = new Set<Texture>()
      group.traverse((object) => {
        const material = (object as Mesh).material
        if (!material) return
        for (const entry of Array.isArray(material) ? material : [material]) {
          for (const texture of texturesOf(entry)) if (!texture.isRenderTargetTexture) seen.add(texture)
          for (const uniform of Object.values((entry as ShaderMaterial).uniforms ?? {})) {
            const value = (uniform as { value?: Texture }).value
            if (value?.isTexture && !value.isRenderTargetTexture) seen.add(value)
          }
        }
      })
      for (const texture of seen) releaseTexture(texture)
    },
  }
}
