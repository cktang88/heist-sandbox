import { switchOff } from '../devices/terminal'
import { burst } from '../effects'
import { addSmoke } from '../hazards/smoke'
import { startSpray } from '../hazards/sprays'
import { tileKey } from '../hazards/state'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import type { Device, World } from '../world'

/**
 * What standing water does to the rest of the world: it puts out fire it covers and keeps the floor wet (so
 * `isWetAt` and the fire code see it), boils off in a puff of steam where it meets flames, and shorts out
 * electronics it reaches, whether by rising to them or by a spray soaking them.
 */
const WETS_AT = 0.02
/** Wet marks are refreshed every liquid tick, so this only has to outlast one. */
const WET_HOLD = 0.6
const STEAM_SPRAYS = 10
const SPARK = '#ffd36b'
const SHORTS: ReadonlySet<Device['kind']> = new Set(['camera', 'computer', 'fusebox', 'alarmButton', 'keypad', 'radioRelay', 'elevatorPanel'])

export function soakFromPuddles(world: World): void {
  const field = world.systems.water
  if (!field || field.active.length === 0) return
  const hazards = world.hazards
  const width = world.grid.width
  for (const key of field.active) {
    const depth = field.depth[key]
    if (depth < WETS_AT) continue
    hazards.wet.set(key, WET_HOLD)
    hazards.wet.set(key + width, WET_HOLD)
    const rows = Math.max(1, Math.ceil(depth))
    for (let row = 0; row < rows; row += 1) {
      const covered = key - row * width
      if (covered >= 0 && hazards.fires.delete(covered)) hiss(world, covered % width, (covered - (covered % width)) / width)
    }
  }
}

/** Water meeting fire: a cloud of steam where it went out. */
function hiss(world: World, x: number, y: number): void {
  addSmoke(world, x, y, 0.5, 'screen')
  if (world.hazards.sprays.length >= STEAM_SPRAYS || world.systems.rng() > 0.3) return
  startSpray(world, { x: x + 0.5, y: y + 0.5, angle: -Math.PI / 2, spread: 0.6, reach: 2, kind: 'steam', life: 1.2 })
  playSound(world, 'spray', { x: x + 0.5, y: y + 0.5 })
}

/** Is this device under water, or soaked by a spray (`spraying` says whether any water spray is running)? */
export function deviceSoaked(world: World, device: Device, spraying: boolean): boolean {
  if (spraying && world.hazards.wet.has(tileKey(world, device.x, device.y))) return true
  const field = world.systems.water
  if (!field || field.active.length === 0) return false
  // The tile people stand on below the device, then how high the water there reaches.
  for (let row = device.y; row < device.y + 7; row += 1) {
    if (!isSolidAt(world.grid, device.x + 0.5, row + 1.5)) continue
    const depth = field.depth[tileKey(world, device.x, row)] ?? 0
    return depth > 0 && row + 1 - depth < device.y + 0.6
  }
  return false
}

/** Shorts out every working device standing in water or caught in a spray. */
export function shortSoakedDevices(world: World): void {
  const spraying = world.hazards.sprays.some((spray) => spray.kind === 'water')
  if (!spraying && !world.systems.water?.active.length) return
  for (const device of world.devices) {
    if (device.disabled || !SHORTS.has(device.kind) || !deviceSoaked(world, device, spraying)) continue
    shortDevice(world, device)
  }
}

export function shortDevice(world: World, device: Device): void {
  const at = { x: device.x + 0.5, y: device.y + 0.5 }
  switchOff(world, [device], Number.POSITIVE_INFINITY)
  if (device.kind === 'fusebox' && device.circuit !== undefined) world.deadCircuits.add(device.circuit)
  burst(world.effects, world.systems.rng, at, 12, SPARK, 7)
  playSound(world, 'spark', at)
  emitNoise(world, at, 3)
}
