import { cameraView } from '../../game/security/cameras'
import { isOpaqueAt } from '../../game/tiles'
import type { Vec } from '../../game/types'
import type { Device, World } from '../../game/world'

/** A cut camera hangs nose-down on its bracket. */
const DROOP = 1.35
const MAX_REACH = 10
const STEP = 0.25

/** Where a camera is pointing, as an angle in game space (x right, y down; 0 looks right): the same sweep the security system watches with. */
export function cameraAim(world: World, device: Device): number {
  if (!device.disabled) return cameraView(world, device).angle
  return (device.facing ?? 1) > 0 ? DROOP : Math.PI - DROOP
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
