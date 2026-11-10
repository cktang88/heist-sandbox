import { tileAt } from '../tiles'
import type { Vec } from '../types'
import type { Device, World } from '../world'
import { floorSpan, type Floor } from './floor'
import { deviceState, doorKey } from './state'

/** An ordinary door lock. */
export const PICK_SECONDS = 1.3
/** A keypad-secured door (the vault): picking it by hand takes a long, exposed while. */
export const SECURE_PICK_SECONDS = 6
/** Doors are three tiles tall; a keypad's target is the bottom one. */
const DOOR_HEIGHT = 3

function isVec(target: Device['target']): target is Vec {
  return typeof target === 'object'
}

/** The keypad that secures this door tile, if any. */
export function keypadFor(world: World, tile: Vec): Device | undefined {
  return world.devices.find((device) => device.kind === 'keypad' && isVec(device.target)
    && device.target.x === tile.x && tile.y <= device.target.y && tile.y > device.target.y - DOOR_HEIGHT)
}

export function isDoorUnlocked(world: World, tile: Vec): boolean {
  if (deviceState(world).unlockedDoors.has(doorKey(tile))) return true
  return keypadFor(world, tile)?.hacked === true
}

/** Seconds of lockpicking this door needs; 0 means it opens at a touch. */
export function lockSeconds(world: World, tile: Vec): number {
  if (isDoorUnlocked(world, tile)) return 0
  return keypadFor(world, tile) ? SECURE_PICK_SECONDS : PICK_SECONDS
}

/** Releases every door lock on a floor, keypads included. The doors stay shut until someone opens them. */
export function unlockFloorDoors(world: World, floor: Floor): void {
  const span = floorSpan(floor)
  if (!span) return
  const unlocked = deviceState(world).unlockedDoors
  for (let y = floor.floorY - DOOR_HEIGHT; y < floor.floorY; y += 1) {
    for (let x = span.from; x <= span.to; x += 1) {
      if (tileAt(world.grid, x, y) !== 'door') continue
      unlocked.add(doorKey({ x, y }))
      const keypad = keypadFor(world, { x, y })
      if (keypad) keypad.hacked = true
    }
  }
}
