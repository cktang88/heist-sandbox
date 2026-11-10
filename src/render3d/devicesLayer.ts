import { Group } from 'three'
import { isCircuitLive } from '../game/devices/devices'
import { feedLooped } from '../game/stealth/cameraLoop'
import type { Device, World } from '../game/world'
import { addBuildJob } from './core/buildQueue'
import { prepareJob } from './core/gpu'
import { cameraAim, cameraLens, cameraReach } from './devices/cameraAim'
import { buildDevice, type DeviceModel, type DeviceState } from './devices/models'
import { inView, type LayerFactory } from './layer'
import { BACK } from './levelMesh'

/** Wall devices are drawn a little larger than life so they read at game zoom. */
const WALL_DEVICE_SCALE = 1.35

type Placed = { model: DeviceModel; key: string; ready: boolean }

/** What a device shows. A camera whose feed is looped from a terminal is as harmless as a hacked one and shows it. */
export function drawnState(world: World, device: Device): DeviceState {
  const hacked = device.hacked || (device.kind === 'camera' && feedLooped(world, device))
  return { live: isCircuitLive(world, device.circuit), disabled: device.disabled, hacked, open: world.terminal?.device === device.id }
}

function keyOf(state: DeviceState): string {
  return `${state.live ? 1 : 0}${state.disabled ? 1 : 0}${state.hacked ? 1 : 0}${state.open ? 1 : 0}`
}

/** Turns a camera's head to where it is looking and stretches its view cone to the first wall. */
function aimCamera(world: World, device: Device, model: DeviceModel): void {
  const parts = model.camera
  if (!parts) return
  const angle = cameraAim(world, device)
  parts.pivot.rotation.z = -angle
  // Keep the sun shade on top when the camera looks left.
  parts.pivot.scale.y = Math.cos(angle) < 0 ? -1 : 1
  if (!parts.cone.visible) return
  // The cone lives inside the scaled-up model, so its length is divided back down to reach the real wall.
  parts.cone.scale.setScalar(Math.max(0.5, cameraReach(world, cameraLens(device), angle) / WALL_DEVICE_SCALE - parts.lensOffset))
}

/** Devices are built ahead of time in groups of about a screen, nearest the view first. */
const CELL_W = 48
const CELL_H = 36

/**
 * Cameras, terminals, fuse boxes, keypads, alarm buttons and the rest, mounted on the back wall or standing in the room.
 * Models are built ahead of the camera by the build queue, a few at a time; one that comes into view before its turn is
 * built at once. Each is only redrawn when its state changes.
 */
export const createDevicesLayer: LayerFactory = (world) => {
  const group = new Group()
  const placed = new Map<Device, Placed>()

  function place(device: Device): Placed {
    const known = placed.get(device)
    if (known) return known
    const model = buildDevice(device.kind)
    if (model.anchor === 'wall') {
      model.root.position.set(device.x + 0.5, -(device.y + 0.5), BACK)
      model.root.scale.setScalar(WALL_DEVICE_SCALE)
    } else model.root.position.set(device.x + 0.5, -device.y, 0)
    const entry: Placed = { model, key: '', ready: false }
    placed.set(device, entry)
    // It joins the scene (when near the view) only once its shaders and textures are ready.
    prepareJob(model.root, { x: device.x, y: device.y, cause: 'prepare device' }, () => {
      entry.ready = true
    })
    return entry
  }

  const cells = new Map<string, Device[]>()
  for (const device of world.devices) {
    const key = `${Math.floor(device.x / CELL_W)},${Math.floor(device.y / CELL_H)}`
    const list = cells.get(key) ?? cells.set(key, []).get(key)!
    list.push(device)
  }
  for (const [key, list] of cells) {
    const [column, row] = key.split(',').map(Number)
    addBuildJob({
      x: (column + 0.5) * CELL_W, y: (row + 0.5) * CELL_H, cause: `devices ${key}`,
      step() {
        const device = list.pop()
        if (device) place(device)
        return list.length > 0 ? 'more' : 'done'
      },
    })
  }

  return {
    group,
    update(world, frame) {
      for (const device of world.devices) {
        const near = inView(frame, device.x, device.y, 2)
        let entry = placed.get(device)
        if (!near) {
          // Out of the scene graph entirely, not just hidden: three still updates the matrices of hidden objects.
          if (entry) group.remove(entry.model.root)
          continue
        }
        entry ??= place(device)
        if (entry.ready && !entry.model.root.parent) group.add(entry.model.root)
        const state = drawnState(world, device)
        const key = keyOf(state)
        if (key !== entry.key) {
          entry.model.apply(state)
          entry.key = key
        }
        aimCamera(world, device, entry.model)
      }
    },
  }
}
