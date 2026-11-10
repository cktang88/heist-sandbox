import { deviceState } from '../devices/state'
import { switchOff } from '../devices/terminal'
import { burst } from '../effects'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import type { Vec } from '../types'
import type { Device, World } from '../world'
import { makeTileIndex } from './tileIndex'

/** Devices a bullet can wreck. Keypads and light switches are too small and flush to the wall to matter. */
const SHOOTABLE: ReadonlySet<Device['kind']> = new Set(['camera', 'alarmButton', 'radioRelay', 'fusebox', 'elevatorPanel', 'computer'])
/** How far inside its tile a device's casing ends. */
const INSET = 0.15
/** A round slamming into a box of electronics is about as loud as a breaker. */
const WRECK_NOISE = 4
const SPARK = '#ffd36b'

const devicesAt = makeTileIndex<Device>((device) => (SHOOTABLE.has(device.kind) ? [{ x: device.x, y: device.y }] : []))

/** Files the devices by tile now, during loading, rather than on the first shot. */
export function indexDevices(world: World): void {
  devicesAt(world.devices, 0, 0)
}

/** Is a device's casing still worth hitting? One already cut for good is just scrap; one a hack switched off for a while is not. */
function intact(world: World, device: Device): boolean {
  return !device.disabled || deviceState(world).offTimers.has(device.id)
}

/**
 * The device a bullet at this point strikes, if any, wrecked through the same path as cutting its wire:
 * it goes off for good. A wrecked fuse box also kills its lighting circuit. The crack and sparks are heard
 * by guards nearby through the ordinary noise system; cameras, relays and buttons going dead are noticed by
 * the security system the same way as a cut cable.
 */
export function shootDeviceAt(world: World, at: Vec): Device | null {
  for (const device of devicesAt(world.devices, at.x, at.y)) {
    const insideX = at.x >= device.x + INSET && at.x <= device.x + 1 - INSET
    const insideY = at.y >= device.y + INSET && at.y <= device.y + 1 - INSET
    if (!insideX || !insideY || !intact(world, device)) continue
    wreck(world, device)
    return device
  }
  return null
}

function wreck(world: World, device: Device): void {
  const center = { x: device.x + 0.5, y: device.y + 0.5 }
  switchOff(world, [device], Number.POSITIVE_INFINITY)
  if (device.kind === 'fusebox' && device.circuit !== undefined) world.deadCircuits.add(device.circuit)
  burst(world.effects, world.rng, center, 14, SPARK, 8)
  playSound(world, 'spark', center)
  emitNoise(world, center, WRECK_NOISE)
}
