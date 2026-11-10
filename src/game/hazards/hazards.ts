import type { PropState } from '../cover'
import type { Vec } from '../types'
import type { World } from '../world'

/** Fire, smoke, gas and thrown grenades. (Placeholder: nothing burns yet.) */
export type GrenadeKind = 'smoke' | 'flash'
export type HazardState = { grenades: never[] }

export function createHazards(): HazardState {
  return { grenades: [] }
}

export function stepHazards(_world: World, _dt: number): void {}

/** Starts or feeds a fire at a spot. `heat` is 0..1. */
export function igniteAt(_world: World, _at: Vec, _heat: number): void {}

/** How much smoke lies between two points: 0 is clear, 1 is impossible to see through. */
export function smokeBetween(_world: World, _from: Vec, _to: Vec): number {
  return 0
}

/** Called when a prop is destroyed, so barrels can explode and extinguishers can burst. */
export function propBroke(_world: World, _prop: PropState): void {}

export function throwGrenade(_world: World, _kind: GrenadeKind, _from: Vec, _direction: Vec): void {}
