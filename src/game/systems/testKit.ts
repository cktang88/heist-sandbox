import { stepHazards } from '../hazards/hazards'
import type { Projectile } from '../projectiles'
import type { Room, RoomKind } from '../site'
import type { World } from '../world'
import { createSystems } from './state'
import { stepSystems } from './systems'

/**
 * Test helpers for the couplings. Worlds come from `bareWorld` (hazards/testWorld.ts); this gives them fresh couplings
 * state, with no seeded faults: a hand-built test room should hold only what the test puts in it.
 */
export function freshSystems(world: World): World {
  world.systems = createSystems(1)
  world.systems.faultsSeeded = true
  world.deadCircuits.clear()
  return world
}

/** Steps hazards and the couplings at 60 frames a second, advancing the clock as the full step would. */
export function runAll(world: World, seconds: number, each?: () => void): void {
  for (let frame = 0; frame < Math.round(seconds * 60); frame += 1) {
    world.clock += 1 / 60
    stepHazards(world, 1 / 60)
    stepSystems(world, 1 / 60)
    each?.()
  }
}

/** A player's bullet in flight at a spot, heading along `vx, vy` (tiles a second). */
export function bullet(x: number, y: number, vx: number, vy: number): Projectile {
  return { x, y, vx, vy, kind: 'bullet', fromPlayer: true, damage: 30, tileDamage: 10, push: 0, life: 1, power: 1, inTile: -1, inProp: null, struck: null }
}

/** Fires a bullet along a path: it is in flight for one frame, then gone. */
export function shoot(world: World, x: number, y: number, vx: number, vy: number): void {
  world.projectiles.push(bullet(x, y, vx, vy))
  runAll(world, 1 / 60)
  world.projectiles.length = 0
  runAll(world, 1 / 60)
}

export function addRoomOf(world: World, kind: RoomKind, x: number, y: number, w: number, h: number, building = 'test', storey = 0): Room {
  const room: Room = { id: world.rooms.length, x, y, w, h, kind, building, storey, floorY: y + h, security: 0 }
  world.rooms.push(room)
  return room
}
