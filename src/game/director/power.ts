import { deviceBuilding, roomOf } from '../security/places'
import type { Device, World } from '../world'

/**
 * Lighting circuits as the director uses them: a whole building's worth, or one at random. A circuit killed `quietly`
 * is marked as already noticed, so guards do not go to fix what the control room knows is a grid fault; once it is
 * live again the security code forgets the mark by itself.
 */

export function siteCircuits(world: World): number[] {
  const circuits = new Set<number>()
  for (const device of world.devices) if (device.kind === 'fusebox' && device.circuit !== undefined) circuits.add(device.circuit)
  return [...circuits].sort((a, b) => a - b)
}

export function buildingCircuits(world: World, building: string): number[] {
  const circuits = new Set<number>()
  for (const device of world.devices) if (device.circuit !== undefined && deviceBuilding(world, device) === building) circuits.add(device.circuit)
  for (const lamp of world.lamps) {
    if (lamp.circuit !== undefined && roomOf(world, { x: lamp.x, y: lamp.y + 1 })?.building === building) circuits.add(lamp.circuit)
  }
  return [...circuits].sort((a, b) => a - b)
}

export function killCircuit(world: World, circuit: number, quietly: boolean): boolean {
  if (world.deadCircuits.has(circuit)) return false
  world.deadCircuits.add(circuit)
  world.director.signals.ownDead.add(circuit)
  if (quietly) world.security.circuitsNoticed.add(circuit)
  return true
}

/** Puts back a circuit the director killed, unless its fuse box has since been wrecked. */
export function reviveCircuit(world: World, circuit: number): void {
  world.director.signals.ownDead.delete(circuit)
  if (fuseBoxOf(world, circuit)?.disabled) return
  world.deadCircuits.delete(circuit)
}

export function fuseBoxOf(world: World, circuit: number): Device | undefined {
  return world.devices.find((device) => device.kind === 'fusebox' && device.circuit === circuit)
}
