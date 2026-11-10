import type { Guard } from '../guards'

/** A guard sent flying by a kick or a heavy blow. The melee code moves him (with gravity) until he comes to rest. */
export type Knock = { guard: Guard; vx: number; vy: number }

/** Punches landed on one guard in a quick run; `need` is how many put him out, fixed by whether he saw it coming. */
export type Daze = { hits: number; need: number; until: number }

export type MeleeState = {
  /** Seconds until the next punch or kick can be thrown. */
  cooldown: number
  knocks: Knock[]
  dazes: Map<Guard, Daze>
  /** The guard held in front of the player as a human shield. */
  shield: Guard | null
  /** The last blow or throw, and when, so the body can be drawn mid-punch, mid-kick or following through. */
  strike: { kind: 'punch' | 'kick' | 'throw'; at: number } | null
}

export function createMelee(): MeleeState {
  return { cooldown: 0, knocks: [], dazes: new Map(), shield: null, strike: null }
}
