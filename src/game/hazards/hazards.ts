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

/**
 * Read-only views for drawing. Their shapes are a contract with the renderer: keep them stable.
 * Cells are one tile each; `intensity` and `density` run 0..1.
 */
export type FireCell = Vec & { intensity: number }
export type SmokeCell = Vec & { density: number; toxic: boolean }
export type GrenadeView = Vec & { kind: GrenadeKind; fuse: number }
export type SprayView = Vec & { angle: number; kind: 'water' | 'foam' | 'steam' | 'gas' }
/** A flash going off right now, so the renderer can light the room. `life` counts down from 1. */
export type FlashView = Vec & { life: number }

export function fireCells(_world: World): readonly FireCell[] {
  return []
}
export function smokeCells(_world: World): readonly SmokeCell[] {
  return []
}
export function grenadeViews(_world: World): readonly GrenadeView[] {
  return []
}
export function sprayViews(_world: World): readonly SprayView[] {
  return []
}
export function flashViews(_world: World): readonly FlashView[] {
  return []
}

export function throwGrenade(_world: World, _kind: GrenadeKind, _from: Vec, _direction: Vec): void {}
