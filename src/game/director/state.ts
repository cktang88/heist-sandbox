import { createRng, type Rng } from '../rng'
import type { SiteKind } from '../world'
import { CONDITIONS } from './conditions/registry'
import type { ConditionId, DirectorState } from './types'

export type { DirectorState } from './types'

/** Mixed into the seed so the director's dice are not the same numbers the site generator rolled. */
const DIRECTOR_SALT = 0x5eed_d1ec
/** Odds of a third condition; otherwise there are two. */
const THIRD_ODDS = 0.45

export function createDirector(seed: number, site: SiteKind): DirectorState {
  const rng = createRng((seed ^ DIRECTOR_SALT) >>> 0)
  return {
    enabled: false, site, rng, picks: pickConditions(rng, site), conditions: [], started: false, running: [], history: [],
    cooldowns: new Map(), nextLook: 0, lastEventAt: -Infinity, tension: 0, lastDecision: '',
    masking: { outdoors: 0, rooms: new Set() }, lightningAt: -Infinity,
    signals: { lastSeenAt: -Infinity, powerCuts: 0, knownDead: new Set(), ownDead: new Set(), out: new Set(), woke: [], dealt: new Set() },
    rivalVictims: new Set(),
  }
}

/** Two or three conditions that fit the site and do not rule each other out, in a seeded order. */
export function pickConditions(rng: Rng, site: SiteKind): ConditionId[] {
  const wanted = rng() < THIRD_ODDS ? 3 : 2
  const pool = CONDITIONS.filter((condition) => condition.fits(site))
  const picks: ConditionId[] = []
  while (picks.length < wanted && pool.length > 0) {
    const [chosen] = pool.splice(Math.floor(rng() * pool.length), 1)
    const clash = picks.some((id) => chosen.excludes.includes(id) || CONDITIONS.find((other) => other.id === id)?.excludes.includes(chosen.id))
    if (!clash) picks.push(chosen.id)
  }
  return picks
}
