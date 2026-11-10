import type { Input } from '../input'
import type { Lamp } from '../site'
import type { World } from '../world'

/** Cameras, computers, fuse boxes, keypads and alarm buttons. (Placeholder: they do nothing yet.) */
export function stepDevices(_world: World, _input: Input, _dt: number): void {}

/** Is this lighting circuit still powered? Cutting a fuse box kills its circuit. */
export function isCircuitLive(world: World, circuit: number | undefined): boolean {
  return circuit === undefined || !world.deadCircuits.has(circuit)
}

export function lampPowered(world: World, lamp: Lamp): boolean {
  return isCircuitLive(world, lamp.circuit)
}
