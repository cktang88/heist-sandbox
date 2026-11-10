import type { Vec } from '../types'

/**
 * The player's quiet toolkit, as it stands mid-heist: the body on his shoulder, a choke in progress, where he is
 * hiding, what he has lifted off the guards (radios, a uniform, a keycard), and the small traces he leaves (blood).
 * Guard indices point into `world.guards`; prop ids into `world.props`.
 */

/** A choke or a struggle in progress. `need` is the seconds it takes; a `struggle` (from the front, or on a man who knows) is loud. */
export type Choke = { guard: number; t: number; need: number; struggle: boolean; noiseIn: number; side: 1 | -1 }

/** Where the player is hiding: inside a locker or stall, or flat under a desk or bed. */
export type Hiding = { prop: number; how: 'inside' | 'under' }

/** A blood pool or drop. `noticed` once a guard has seen it, so it is only reported once. */
export type Blood = Vec & { noticed: boolean }

/** A radio in the player's pocket is being called: answer before `until` or control marks the man missing. */
export type CheckInCall = { guard: number; until: number }

/** A noisy thing (a TV, a vending machine) switched on to pull a guard; it runs until someone switches it off. */
export type Noisemaker = { prop: number; at: Vec; nextNoise: number; blared: boolean }

/** A fuse box rigged to trip on a timer, so the lights die while the player is somewhere else. */
export type RiggedBreaker = { device: number; at: number }

/** A lure (a whistle, a switched-on TV) and when: guards lured to the same area again grow suspicious. */
export type Lure = Vec & { clock: number }

export type StealthState = {
  carried: number | null
  /** Whether grab was held last frame: picking up and dropping are on the press, not the hold. */
  grabWas: boolean
  choke: Choke | null
  hiding: Hiding | null
  /** Hiding places (prop id) a guard (index) saw the player get into, and is walking over to open. */
  watched: Map<number, number>
  /** Hiding places searchers have opened, and when, so the next searcher looks elsewhere. */
  opened: Map<number, number>
  /** Bodies (guard indices) guards have found, for the end screen. */
  found: Set<number>
  blood: Blood[]
  /** Guards killed by a blade: drops left to leave while carried, and where the last one fell. */
  bleeding: Map<number, number>
  lastDrop: Vec | null
  /** Guards whose radio, uniform or keycard the player has taken. */
  radios: Set<number>
  uniforms: Set<number>
  keycards: Set<number>
  checkIn: CheckInCall | null
  bluffs: number
  /** Wearing a guard's uniform; `officer` if it was an officer's. */
  disguise: { officer: boolean } | null
  /** Clock time a guard found a body stripped of its uniform: disguises fail faster for a while. */
  uniformKnownAt: number
  /** Darts that have hit: the guard drops at `at`. */
  darts: { guard: number; at: number }[]
  noisemakers: Noisemaker[]
  /** How many times each noisy prop has been switched on. */
  noisemakerUses: Map<number, number>
  lures: Lure[]
  rigged: RiggedBreaker[]
  /** Camera device id to the clock time its looped feed runs out. */
  looped: Map<number, number>
  /** A second line under the prompt: the other thing E would do (e.g. crouch to choke instead). */
  hint: string | null
}

export function createStealth(): StealthState {
  return {
    carried: null, grabWas: false, choke: null, hiding: null, watched: new Map(), opened: new Map(), found: new Set(), blood: [], bleeding: new Map(), lastDrop: null,
    radios: new Set(), uniforms: new Set(), keycards: new Set(), checkIn: null, bluffs: 0, disguise: null, uniformKnownAt: -Infinity,
    darts: [], noisemakers: [], noisemakerUses: new Map(), lures: [], rigged: [], looped: new Map(), hint: null,
  }
}
