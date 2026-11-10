import { Group } from 'three'
import { isCircuitLive } from '../game/devices/devices'
import type { Device, World } from '../game/world'
import { cameraAim, cameraLens, cameraReach } from './devices/cameraAim'
import { buildDevice, type DeviceModel, type DeviceState } from './devices/models'
import { inView, type LayerFactory } from './layer'
import { BACK } from './levelMesh'

/** Wall devices are drawn a little larger than life so they read at game zoom. */
const WALL_DEVICE_SCALE = 1.35

type Placed = { model: DeviceModel; key: string }

function stateOf(world: World, device: Device): DeviceState {
  return { live: isCircuitLive(world, device.circuit), disabled: device.disabled, hacked: device.hacked, open: world.terminal?.device === device.id }
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

/**
 * Cameras, terminals, fuse boxes, keypads, alarm buttons and the rest, mounted on the back wall or standing in the room.
 * Models are built the first time they come near the view and only redrawn when their state changes.
 */
export const createDevicesLayer: LayerFactory = () => {
  const group = new Group()
  const placed = new Map<Device, Placed>()

  return {
    group,
    update(world, frame) {
      for (const device of world.devices) {
        const near = inView(frame, device.x, device.y, 2)
        let entry = placed.get(device)
        if (!near) {
          if (entry) entry.model.root.visible = false
          continue
        }
        if (!entry) {
          const model = buildDevice(device.kind)
          if (model.anchor === 'wall') {
            model.root.position.set(device.x + 0.5, -(device.y + 0.5), BACK)
            model.root.scale.setScalar(WALL_DEVICE_SCALE)
          } else model.root.position.set(device.x + 0.5, -device.y, 0)
          group.add(model.root)
          entry = { model, key: '' }
          placed.set(device, entry)
        }
        entry.model.root.visible = true
        const state = stateOf(world, device)
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
