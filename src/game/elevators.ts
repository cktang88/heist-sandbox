import type { Input } from './input'
import type { ElevatorShaft } from './site'
import type { World } from './world'

/** An elevator car. `y` is the floor row its passengers stand on. (Placeholder: cars do not move yet.) */
export type ElevatorCar = { shaft: number; y: number; targetStop: number | null; doorsOpen: boolean; locked: boolean }

export function createElevators(shafts: readonly ElevatorShaft[]): ElevatorCar[] {
  return shafts.map((shaft) => ({ shaft: shaft.id, y: shaft.stops[0], targetStop: null, doorsOpen: false, locked: false }))
}

export function stepElevators(_world: World, _input: Input, _dt: number): void {}
