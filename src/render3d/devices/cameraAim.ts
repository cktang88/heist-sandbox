import { isOpaqueAt } from '../../game/tiles'
import type { Vec } from '../../game/types'
import type { Device, World } from '../../game/world'

/** How far below level a camera looks, and how far its sweep swings either side, in radians. */
const TILT = 0.5
const SWING = 0.42
const SWEEP_SPEED = 0.55
/** A cut camera hangs nose-down on its bracket. */
const DROOP = 1.35
const MAX_REACH = 10
const STEP = 0.25

/**
 * Where a camera is pointing, as an angle in game space (x right, y down; 0 looks right).
 * (A stand-in sweep until the security system exports `cameraView(world, device)`; swap it in here.)
 */
export function cameraAim(world: World, device: Device): number {
  const facing = device.facing ?? 1
  const pitch = device.disabled ? DROOP : TILT + SWING * Math.sin(world.clock * SWEEP_SPEED + device.id * 1.7)
  return facing > 0 ? pitch : Math.PI - pitch
}

/** How far a camera's view reaches along `angle` before a wall or floor blocks it. */
export function cameraReach(world: World, from: Vec, angle: number): number {
  const dx = Math.cos(angle) * STEP
  const dy = Math.sin(angle) * STEP
  let x = from.x
  let y = from.y
  for (let travelled = 0; travelled < MAX_REACH; travelled += STEP) {
    x += dx
    y += dy
    if (isOpaqueAt(world.grid, x, y)) return travelled
  }
  return MAX_REACH
}

/** The lens of a wall camera sits in the middle of its tile. */
export function cameraLens(device: Device): Vec {
  return { x: device.x + 0.5, y: device.y + 0.5 }
}
