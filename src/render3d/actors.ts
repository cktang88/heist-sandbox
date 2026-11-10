import { Group, Mesh } from 'three'
import { guardMood, type Guard } from '../game/guards'
import type { TileKind } from '../game/tiles'
import { TOOLS } from '../game/toolDefs'
import { handOf } from '../game/tools'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import type { Motion } from '../render/human/pose'
import { clearBuildJobs, runBuildJobs } from './core/buildQueue'
import { noteFramePart } from './core/frameProbe'
import { createGpuProbe } from './core/gpu'
import { measured } from './core/timing'
import { createEffects3d } from './fx3d'
import type { SurfaceMaterials, SurfaceName } from './levelMesh'
import { Figure, outfitFor, weaponFor } from './people3d'
import { BOX, buildDrone, buildLoot, buildParachute, buildPickup, buildVan, CHARGE_LIGHT, CHARGE_MATERIAL } from './props3d'
import { createDevicesLayer } from './devicesLayer'
import { createFixturesLayer } from './fixturesLayer'
import { depthOffsetFor } from '../game/gaps/gaps'
import { onLine } from '../game/grapple/state'
import { createGapsLayer } from './gapsLayer'
import { createGrappleLayer } from './grappleLayer'
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

/** People on a staircase are drawn further back, on the stairs behind the walking lane. */
const STAIR_LANE = -1.5

const FALLING_SURFACE: Partial<Record<TileKind, SurfaceName>> = {
  dirt: 'dirt', brick: 'brick', concrete: 'concrete', steel: 'steel', wood: 'wood', door: 'door', glass: 'glass',
}

export function createActors(world: World, materials: SurfaceMaterials): Actors {
  const group = new Group()
  // Jobs left over from an earlier level would build into a scene that is gone.
  clearBuildJobs()
  const effects = createEffects3d()
  group.add(effects.group, createGpuProbe())
  // Each layer owns one slice of the scene. They are independent, so they can be worked on separately.
  const factories: [string, LayerFactory][] = [
    ['rooms', createRoomsLayer], ['props', createPropsLayer], ['fixtures', createFixturesLayer], ['devices', createDevicesLayer],
    ['structure', createStructureLayer], ['hazards', createHazardsLayer], ['sandbox', createSandboxLayer], ['gaps', createGapsLayer],
    ['grapple', createGrappleLayer],
  ]
  // Each layer's set-up and per-frame time is measured, for the `?debug=1` readout (User Timing and the frame probe).
  const layers: { name: string; layer: Layer }[] = []

  const player = new Figure('operative')
  const parachute = buildParachute()
  group.add(player.group, parachute)
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
  let lastClock = world.clock

  return {
    group,
    buildNext() {
      const next = factories[layers.length]
      if (!next) return true
      const [name, create] = next
      const layer = measured(`build layer ${name}`, () => create(world, materials))
      layers.push({ name: `layer ${name}`, layer })
      group.add(layer.group)
      return layers.length === factories.length
    },
    update(now, aim, view) {
      const near = (x: number, y: number) => Math.abs(x - view.x) < DRAW_DISTANCE && Math.abs(y - view.y) < DRAW_DISTANCE * 0.62
      const hero = now.player
      const feet = { x: hero.x + hero.w / 2, y: hero.y + hero.h }
      const hand = handOf(now)
      const motion: Motion = {
        x: feet.x, feetY: feet.y, facing: hero.facing, vx: hero.vx, vy: hero.vy, onGround: hero.onGround,
        mode: hero.chute ? 'chute' : hero.stairs ? 'stairs' : hero.onLadder || onLine(now.grapple) ? 'ladder' : hero.crouching ? 'crouch' : 'normal',
        aim: Math.atan2(aim.y - hand.y, aim.x - hand.x), kick: hero.kick,
      }
      const body = player.animate({ ...motion, clock: now.clock }, now.drone ? 'drone' : TOOLS[hero.tool].id)
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
        const mood = guardMood(guard)
        if (mood === 'dead') {
          if (guard.ragdoll) figure.poseRagdoll(guard.ragdoll)
          continue
        }
        const base = { x: guard.x + guard.w / 2, y: guard.y + guard.h }
        // A fighting guard aims at where he believes the player is (his last known position), never the true spot.
        const target = guard.target
        const relaxed = guard.facing > 0 ? 0.35 : Math.PI - 0.35
        const alert = guard.state !== 'patrol'
        figure.animate({
          x: base.x, feetY: base.y, facing: guard.facing, vx: guard.vx, vy: guard.vy, onGround: guard.onGround,
          mode: guard.stairs ? 'stairs' : guard.climbing ? 'ladder' : guard.crouching ? 'crouch' : 'normal',
          aim: mood === 'alert' && target ? Math.atan2(target.y - (guard.y + 0.5), target.x - base.x) : relaxed, kick: guard.kick, clock: now.clock, alert,
        }, weaponFor(guard.role, guard.armored, alert), guard.hitFlash > 0)
        figure.group.position.z = guard.stairs ? STAIR_LANE : depthOffsetFor(now, guard)
      }


      loot.visible = !now.loot.taken
      loot.position.set(now.loot.x, -(now.loot.y + now.loot.h), 0)
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
        block.position.set(charge.x + charge.w / 2, -(charge.y + charge.h / 2), 0.1)
        block.scale.set(charge.w, charge.h, 0.3)
        light.position.set(charge.x + charge.w / 2, -charge.y, 0.2)
        light.scale.setScalar(0.08)
      })

      now.falling.forEach((tile, index) => {
        let mesh = falling[index]
        if (!mesh) {
          mesh = new Mesh(BOX, materials.concrete)
          mesh.castShadow = true
          falling.push(mesh)
          group.add(mesh)
        }
        mesh.visible = true
        mesh.material = materials[FALLING_SURFACE[tile.kind] ?? 'concrete']
        mesh.position.set(tile.x + 0.5, -(tile.y + 0.5), -0.95)
        mesh.scale.set(1, 1, 2.9)
      })
      for (let index = now.falling.length; index < falling.length; index += 1) falling[index].visible = false

      const dt = Math.max(0, now.clock - lastClock)
      effects.update(now, dt)
      for (const { name, layer } of layers) {
        const start = performance.now()
        layer.update(now, { dt, view, aim })
        noteFramePart(name, performance.now() - start)
      }
      runBuildJobs(view)
      lastClock = now.clock
    },
    dispose() {},
  }
}
