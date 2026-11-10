import { eyeOf, isActive, type Guard } from '../security/model'
import { clearView, hasTorchOut, isAlerted, lightFactor, playerLight, zoneOf } from '../security/perception'
import { hasLineOfSight } from '../vision'
import { CAMERAS, VISION } from '../security/tuning'
import { centerOf, distance, type Vec } from '../types'
import { cameraView, type CameraView } from '../security/cameras'
import type { World } from '../world'
import { guardsOnFloor } from './kit'

/** What the scripted player reads off the screen: who could see him, from how far, right now. */

/** Extra margin past what a guard sees, so a turn of his head does not catch the player. */
export const MARGIN = 2.5

/** How far this guard could make the player out right now, given the light on the player and his posture. */
export function sightReach(world: World, guard: Guard): number {
  const light = playerLight(world)
  const crouched = world.player.crouching
  const torch = isAlerted(guard) || guard.mode === 'investigating'
  if (light < VISION.dim) return (torch ? VISION.torchDarkRange : VISION.darkRange) * (crouched ? 0.6 : 1)
  return isAlerted(guard) ? VISION.alertRange : VISION.centralRange
}

/** A guard on the player's floor with a clear view who faces him and is close enough to see him, soon if not now. */
export function threatOf(world: World, guard: Guard): 'facing' | 'behind' | null {
  const player = centerOf(world.player)
  const eye = eyeOf(guard)
  const gap = Math.abs(player.x - eye.x)
  if (gap > VISION.alertRange + MARGIN || !clearView(world, eye, player)) return null
  const facing = (player.x - eye.x) * guard.facing > 0
  if (facing && gap <= sightReach(world, guard) + MARGIN) return 'facing'
  return facing ? null : 'behind'
}


/**
 * Would this guard see the player climb into a hiding place right now, by the game's own rule (stealth/hide.ts): his
 * central cone, walls (not furniture: the player is stepping into it) and the light?
 */
function seesNow(world: World, guard: Guard): boolean {
  const body = centerOf(world.player)
  const eye = eyeOf(guard)
  if (!isActive(guard) || guard.blindSeconds > 0 || zoneOf(guard, eye, body) !== 'central' || !hasLineOfSight(world.grid, eye, body)) return false
  const dark = hasTorchOut(guard) ? VISION.torchDarkRange : VISION.darkRange
  return lightFactor(playerLight(world), distance(eyeOf(guard), body), dark) > 0
}

/** Anyone on his floor who could see him now or at a turn of the head, or who is close enough to walk into him. */
export function anyoneWatching(world: World, near = 4): boolean {
  const player = centerOf(world.player)
  return guardsOnFloor(world).some((guard) => threatOf(world, guard) === 'facing' || seesNow(world, guard) || Math.abs(eyeOf(guard).x - player.x) < near)
}

/** How near a camera must be to matter, and how far ahead the player looks for its cone. */
const CAMERA_NEAR = 16
const LOOK_AHEAD = 1.2

/** Is this point inside the camera's cone right now, with nothing in the way? */
function inCone(world: World, view: CameraView, at: Vec): boolean {
  const gap = distance(view.origin, at)
  if (gap > view.range) return false
  const angle = Math.atan2(at.y - view.origin.y, at.x - view.origin.x)
  const off = Math.abs(Math.atan2(Math.sin(angle - view.angle), Math.cos(angle - view.angle)))
  return off <= view.halfAngle && clearView(world, view.origin, at)
}

/**
 * Cameras, read off the screen like guards: if a working camera's sweep is on the player, get out of it (back the way
 * he came); if it is on the next step, wait for it to swing away. Null when no camera minds. Dark spots it cannot see in.
 */
export function cameraSays(world: World, direction: 1 | -1 | 0): 0 | 1 | -1 | null {
  if (playerLight(world) < CAMERAS.minLight || world.player.hidden) return null
  const body = centerOf(world.player)
  const next = { x: body.x + direction * LOOK_AHEAD, y: body.y }
  let hold = false
  for (const device of world.devices) {
    if (device.kind !== 'camera' || device.disabled || device.hacked) continue
    if (Math.abs(device.x - body.x) > CAMERA_NEAR || Math.abs(device.y - body.y) > 6) continue
    const view = cameraView(world, device)
    if (inCone(world, view, body)) return direction === 0 ? (body.x < view.origin.x ? -1 : 1) : (-direction as 1 | -1)
    if (direction !== 0 && inCone(world, view, next)) hold = true
  }
  return hold ? 0 : null
}
