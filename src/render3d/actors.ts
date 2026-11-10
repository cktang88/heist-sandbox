import { Group, Mesh } from 'three'
import { guardMood, type Guard } from '../game/guards'
import type { TileKind } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'
import { guardMotion, playerMotion } from '../render/human/motion'
import { createEffects3d } from './fx3d'
import type { SurfaceMaterials, SurfaceName } from './levelMesh'
import { Figure, outfitFor, weaponFor } from './people3d'
import { BOX, buildDrone, buildLoot, buildParachute, buildPickup, buildVan, CHARGE_LIGHT, CHARGE_MATERIAL } from './props3d'
import { createDevicesLayer } from './devicesLayer'
import { createFixturesLayer } from './fixturesLayer'
import { depthOffsetFor } from '../game/gaps/gaps'
import { createGapsLayer } from './gapsLayer'
import { createGrappleLayer } from './grappleLayer'
import { createHazardsLayer } from './hazardsLayer'
import { createSandboxLayer } from './sandboxLayer'
import { DRAW_DISTANCE, type Layer } from './layer'
import { createPropsLayer } from './propsLayer'
import { createRoomsLayer } from './roomsLayer'
import { createStructureLayer } from './structureLayer'

/** Everything that moves or can be picked up: people, props, shots and effects. */
export type Actors = { group: Group; update(world: World, aim: Vec, view: Vec): void; dispose(): void }

/** People on a staircase are drawn further back, on the stairs behind the walking lane. */
const STAIR_LANE = -1.5

const FALLING_SURFACE: Partial<Record<TileKind, SurfaceName>> = {
  dirt: 'dirt', brick: 'brick', concrete: 'concrete', steel: 'steel', wood: 'wood', door: 'door', glass: 'glass',
}

export function createActors(world: World, materials: SurfaceMaterials): Actors {
  const group = new Group()
  const effects = createEffects3d()
  group.add(effects.group)
  // Each layer owns one slice of the scene. They are independent, so they can be worked on separately.
  const layers: Layer[] = [createRoomsLayer, createPropsLayer, createFixturesLayer, createDevicesLayer, createStructureLayer, createHazardsLayer, createSandboxLayer, createGapsLayer, createGrappleLayer].map((create) => create(world, materials))
  for (const layer of layers) group.add(layer.group)

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
    update(now, aim, view) {
      const near = (x: number, y: number) => Math.abs(x - view.x) < DRAW_DISTANCE && Math.abs(y - view.y) < DRAW_DISTANCE * 0.62
      const hero = now.player
      const posed = playerMotion(now, aim)
      const body = player.animate(posed.motion, posed.held)
      player.group.position.z = hero.stairs ? STAIR_LANE : depthOffsetFor(now, hero)
      parachute.visible = hero.chute
      parachute.position.set(body.shoulder.x, -body.shoulder.y, 0)

      for (const guard of now.guards) {
        let figure = guards.get(guard)
        // Only people near the view get a body; a big site has far more guards than fit on screen.
        if (!near(guard.x, guard.y)) {
          if (figure) figure.group.visible = false
          continue
        }
        if (!figure) {
          figure = new Figure(outfitFor(guard.role, guard.armored))
          guards.set(guard, figure)
          group.add(figure.group)
        }
        figure.group.visible = true
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
      for (const layer of layers) layer.update(now, { dt, view, aim })
      lastClock = now.clock
    },
    dispose() {},
  }
}
