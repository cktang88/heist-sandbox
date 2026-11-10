import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import type { Device, World } from '../world'
import { floorSpan, onFloor, type Floor } from './floor'

/** How far the clunk of a breaker carries: enough for someone in the stair lobby, not the whole floor. */
const BREAKER_NOISE_RADIUS = 4

export function deviceCenter(device: Device): { x: number; y: number } {
  return { x: device.x + 0.5, y: device.y + 0.5 }
}

/**
 * Throws a fuse box or light switch. A fuse box clunks (guards nearby come to look);
 * a light switch is silent. Either way the circuit's lamps follow `world.deadCircuits`.
 */
export function flipPower(world: World, device: Device): void {
  if (device.circuit === undefined) return
  const at = deviceCenter(device)
  if (world.deadCircuits.has(device.circuit)) world.deadCircuits.delete(device.circuit)
  else world.deadCircuits.add(device.circuit)
  if (device.kind !== 'fusebox') return
  playSound(world, 'switch', at)
  emitNoise(world, at, BREAKER_NOISE_RADIUS)
}

/** For the security AI: a guard (or technician) puts a circuit back on. */
export function restoreCircuit(world: World, circuit: number): void {
  if (!world.deadCircuits.delete(circuit)) return
  const box = world.devices.find((device) => device.circuit === circuit && (device.kind === 'fusebox' || device.kind === 'lightSwitch'))
  if (box) playSound(world, 'switch', deviceCenter(box))
}

/** Every lighting circuit on a floor: those of its fuse boxes and switches, and of lamps hanging inside its rooms. */
export function floorCircuits(world: World, floor: Floor): Set<number> {
  const circuits = new Set<number>()
  for (const device of world.devices) {
    if (device.circuit !== undefined && onFloor(world, floor, device)) circuits.add(device.circuit)
  }
  const span = floorSpan(floor)
  if (!span) return circuits
  for (const lamp of world.lamps) {
    if (lamp.circuit === undefined || lamp.x < span.from || lamp.x > span.to + 1) continue
    if (lamp.y > floor.floorY || lamp.y < Math.min(...floor.rooms.map((room) => room.y)) - 1) continue
    circuits.add(lamp.circuit)
  }
  return circuits
}
