import { centerOf, distance, type Vec } from '../types'
import type { Device, World } from '../world'
import { sayAt } from './barks'
import { feetOf, isActive, type Guard } from './model'
import { clearView, playerLight } from './perception'
import { deviceBuilding, floorName, roomOf } from './places'
import { reportEvent } from './report'
import { CAMERAS } from './tuning'
import { fooledCamera } from '../stealth/disguise'
import { feedLooped } from '../stealth/cameraLoop'

/**
 * Cameras sweep slowly. One that is working (not cut, not hacked) and sees the player in decent light
 * for a moment shows him on a monitor in the security room. That only matters if somebody is in there
 * watching: then the control room gets the sighting and the position, at once.
 */

export type CameraView = { origin: Vec; angle: number; halfAngle: number; range: number; active: boolean }

/** A camera's current facing (radians, y down, 0 = right) and cone, for drawing and for detection. */
export function cameraView(world: World, device: Device): CameraView {
  const facing = device.facing ?? 1
  const period = world.security.level >= 2 ? CAMERAS.alertPeriodSeconds : CAMERAS.periodSeconds
  const sweep = Math.sin((world.clock / period) * Math.PI * 2 + device.id * 1.7) * CAMERAS.sweep
  const centre = facing > 0 ? CAMERAS.tilt : Math.PI - CAMERAS.tilt
  return {
    origin: { x: device.x + 0.5, y: device.y + 0.5 },
    angle: centre + sweep * facing,
    halfAngle: CAMERAS.halfAngle,
    range: CAMERAS.range,
    active: !device.disabled && !device.hacked,
  }
}

function seesPlayer(world: World, view: CameraView): boolean {
  if (!view.active || world.player.hidden) return false
  const target = centerOf(world.player)
  const gap = distance(view.origin, target)
  if (gap > view.range || fooledCamera(world, gap)) return false
  const angle = Math.atan2(target.y - view.origin.y, target.x - view.origin.x)
  const off = Math.abs(Math.atan2(Math.sin(angle - view.angle), Math.cos(angle - view.angle)))
  return off <= view.halfAngle && clearView(world, view.origin, target) && playerLight(world) >= CAMERAS.minLight
}

/** The guard watching the monitors for this building: anyone awake in one of its security rooms (or any security room, if it has none). */
export function watcherFor(world: World, building: string): Guard | null {
  const own = world.rooms.some((room) => room.kind === 'security' && room.building === building)
  for (const guard of world.guards) {
    if (!isActive(guard)) continue
    const room = roomOf(world, feetOf(guard))
    if (room?.kind === 'security' && (!own || room.building === building)) return guard
  }
  return null
}

export function stepCameras(world: World, dt: number): void {
  for (const device of world.devices) {
    if (device.kind !== 'camera') continue
    let watch = world.security.cameras.get(device.id)
    if (!watch) {
      watch = { seen: 0, cooldown: 0 }
      world.security.cameras.set(device.id, watch)
    }
    watch.cooldown = Math.max(0, watch.cooldown - dt)
    // A looped feed shows the empty room it recorded: nothing moves on it, and nothing looks wrong either.
    if (feedLooped(world, device) || !seesPlayer(world, cameraView(world, device))) {
      watch.seen = Math.max(0, watch.seen - dt)
      continue
    }
    watch.seen += dt
    if (watch.seen < CAMERAS.confirmSeconds || watch.cooldown > 0) continue
    const watcher = watcherFor(world, deviceBuilding(world, device))
    if (!watcher) continue
    watch.cooldown = CAMERAS.reportCooldown
    const at = centerOf(world.player)
    sayAt(world, { x: watcher.x + watcher.w / 2, y: watcher.y - 0.5 }, `Camera ${device.id + 1}: movement, ${floorName(world, at)}!`)
    reportEvent(world, { kind: 'camera', at, device: device.id })
  }
}
