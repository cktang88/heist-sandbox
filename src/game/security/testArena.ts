import { createGuard, type Guard } from '../guards'
import { idleInput, type Input } from '../input'
import type { GuardRole, Room } from '../site'
import { stepWorld } from '../step'
import { createGrid, fillTiles, type TileKind } from '../tiles'
import { createWorld, type Device, type World } from '../world'

/**
 * A bare test site for guard behaviour: one long dark floor at row GROUND (night, no lamps), nobody on it,
 * the player parked at the left. Tests add exactly the walls, lamps, guards and devices they need.
 * Only tests import this.
 */
export const GROUND = 30
export const FRAME = 1 / 60

export function arena(): World {
  const world = createWorld(1)
  const grid = createGrid(160, 44)
  fillTiles(grid, 0, GROUND, grid.width - 1, grid.height - 1, 'concrete')
  Object.assign(world, {
    grid, groundY: GROUND, interiors: [], lamps: [], props: [], guards: [], devices: [], rooms: [], stairwells: [], elevators: [],
    pickups: [], timeOfDay: 'night', extraction: { x: 0, y: 0, w: 1, h: 1 },
  })
  Object.assign(world.loot, { x: 150, y: GROUND - 0.8, taken: false })
  putPlayer(world, 10)
  world.player.hp = 1e6
  return world
}

export function putPlayer(world: World, x: number, feetY = GROUND): void {
  Object.assign(world.player, { x: x - world.player.w / 2, y: feetY - world.player.h - 0.01, vx: 0, vy: 0, chute: false })
}

export function addGuard(world: World, x: number, facing: 1 | -1, role: GuardRole = 'post', feetY = GROUND): Guard {
  const guard = createGuard({ x: x - 0.5, y: feetY, facing, role })
  guard.checkInAt = 1e9
  world.guards.push(guard)
  return guard
}

/** A strong lamp over a spot, so whoever stands there is in full light. */
export function addLamp(world: World, x: number, feetY = GROUND): void {
  world.lamps.push({ x, y: feetY - 4, fixture: 'floodlight', color: 0xffffff, radius: 9, strength: 2, hung: false })
}

export function addWall(world: World, x: number, kind: TileKind = 'brick', feetY = GROUND): void {
  fillTiles(world.grid, x, feetY - 6, x, feetY - 1, kind)
}

export function addDevice(world: World, device: Omit<Device, 'id' | 'disabled' | 'hacked'> & Partial<Device>): Device {
  const made: Device = { disabled: false, hacked: false, ...device, id: world.devices.length }
  world.devices.push(made)
  return made
}

export function addRoom(world: World, room: Omit<Room, 'id' | 'y' | 'h' | 'storey' | 'security'> & Partial<Room>): Room {
  const made: Room = { y: room.floorY - 5, h: 5, storey: 0, security: 1, ...room, id: world.rooms.length }
  world.rooms.push(made)
  return made
}

/** Runs the game, calling `each` after every frame (return true to stop early). */
export function run(world: World, seconds: number, input: Partial<Input> = {}, each?: () => boolean | void): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
    if (each?.()) return
  }
}
