import type { Rng } from '../rng'
import type { Tier } from '../security/model'
import type { TraitId } from './types'

/**
 * The traits a guard can have and the numbers each one changes. The security code keeps making every decision;
 * these multipliers are applied from outside, to the public numbers it reads (awareness, draw time, shock, waits).
 */

export type TraitEffect = {
  /** Share of each rise in his awareness meter that is kept (1 = as the security code says). */
  awareness: number
  /** Multiplies the time from "Contact!" to his first shot. */
  draw: number
  /** Multiplies each rise in his fright. */
  shock: number
  /** Multiplies how long his searches run. */
  search: number
  /** Seconds added to the pause before he walks over to look at something. */
  slowToLook: number
  /** How much more often (than 1) he does something idle. */
  idle: number
}

const NEUTRAL: TraitEffect = { awareness: 1, draw: 1, shock: 1, search: 1, slowToLook: 0, idle: 1 }

export const TRAITS: Record<TraitId, { label: string; effect: Partial<TraitEffect>; tiers?: readonly Tier[] }> = {
  jumpy: { label: 'jumpy', effect: { awareness: 1.35, draw: 0.6 } },
  lazy: { label: 'lazy', effect: { search: 0.6, slowToLook: 1.5, idle: 1.5 } },
  byTheBook: { label: 'by the book', effect: { search: 1.3, idle: 0.3 } },
  brave: { label: 'brave', effect: { shock: 0.6 } },
  coward: { label: 'coward', effect: { shock: 1.5 } },
  sharpEyed: { label: 'sharp-eyed', effect: { awareness: 1.35 } },
  halfDeaf: { label: 'half-deaf', effect: {} },
  nightBlind: { label: 'night-blind', effect: {} },
  smoker: { label: 'smoker', effect: { idle: 1.4 } },
  chatty: { label: 'chatty', effect: { idle: 1.3 } },
  greedy: { label: 'greedy', effect: {} },
  loyal: { label: 'loyal', effect: { shock: 0.9 } },
  triggerHappy: { label: 'trigger-happy', effect: { draw: 0.4 } },
  careful: { label: 'careful', effect: { draw: 1.3, search: 1.4 } },
  clumsy: { label: 'clumsy', effect: {} },
  green: { label: 'new on the job', effect: { shock: 1.25, draw: 1.2 }, tiers: ['rookie'] },
  hungover: { label: 'hungover tonight', effect: { awareness: 0.75, idle: 1.3 } },
}

/**
 * How far traits together may bend each number. Multiplied freely, two of them compound (jumpy and trigger-happy drew
 * in a quarter of the normal time, a shot before "Contact!" was out): a man is never far past his strongest trait.
 */
const LIMITS = {
  awareness: [0.5, 1.5], draw: [0.4, 1.5], shock: [0.5, 1.6], search: [0.5, 1.5], idle: [0.3, 2],
} as const satisfies Partial<Record<keyof TraitEffect, readonly [number, number]>>

/** Pairs that cannot both describe one man. */
const CLASHES: ReadonlyArray<readonly [TraitId, TraitId]> = [
  ['brave', 'coward'], ['jumpy', 'careful'], ['lazy', 'byTheBook'], ['greedy', 'loyal'], ['triggerHappy', 'careful'],
  ['halfDeaf', 'sharpEyed'], ['nightBlind', 'sharpEyed'], ['green', 'lazy'],
]

/** Night-blind: in poor light he keeps only this share of what he would otherwise notice. */
export const NIGHT_BLIND_KEEP = 0.4
/** Half-deaf: while calm he is deaf for this share of the time. */
export const HALF_DEAF_SHARE = 0.5
/** Brave: his fright never climbs past this. */
export const BRAVE_SHOCK_CAP = 0.45
/** Hungover wears off after this many seconds of the heist. */
export const HANGOVER_SECONDS = 360

export function clashes(a: TraitId, b: TraitId): boolean {
  return CLASHES.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
}

/** Two or three traits that fit together and fit his experience. */
export function pickTraits(rng: Rng, tier: Tier): TraitId[] {
  const count = rng() < 0.45 ? 3 : 2
  const all = Object.keys(TRAITS) as TraitId[]
  const chosen: TraitId[] = []
  for (let tries = 0; chosen.length < count && tries < 40; tries += 1) {
    const trait = all[Math.floor(rng() * all.length)]
    const tiers = TRAITS[trait].tiers
    if (chosen.includes(trait) || (tiers && !tiers.includes(tier)) || chosen.some((other) => clashes(other, trait))) continue
    chosen.push(trait)
  }
  return chosen
}

/** All of a man's traits together, as one set of multipliers. */
export function effectOf(traits: readonly TraitId[], clock: number): TraitEffect {
  const total = { ...NEUTRAL }
  for (const trait of traits) {
    if (trait === 'hungover' && clock > HANGOVER_SECONDS) continue
    const effect = TRAITS[trait].effect
    total.awareness *= effect.awareness ?? 1
    total.draw *= effect.draw ?? 1
    total.shock *= effect.shock ?? 1
    total.search *= effect.search ?? 1
    total.slowToLook += effect.slowToLook ?? 0
    total.idle *= effect.idle ?? 1
  }
  for (const key of Object.keys(LIMITS) as Array<keyof typeof LIMITS>) {
    const [low, high] = LIMITS[key]
    total[key] = Math.min(high, Math.max(low, total[key]))
  }
  return total
}
