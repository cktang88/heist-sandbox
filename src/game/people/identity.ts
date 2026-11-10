import type { Rng } from '../rng'
import { nameOf as fallbackName } from '../security/barks'
import type { Guard, Tier } from '../security/model'
import type { GuardRole } from '../site'
import { ABSENT, ABSENT_REASONS, FIRST_NAMES, HABITS, SAVING_FOR, SURNAMES, TOWNS } from './names'
import { pickTraits } from './traits'
import type { AgeBand, Person, Snapshot, TraitId } from './types'

/** Rank titles by role and experience; responders in armour are their own unit. */
const RANKS: Record<GuardRole, Record<Tier, string>> = {
  patrol: { rookie: 'Trainee', regular: 'Guard', veteran: 'Senior Guard' },
  post: { rookie: 'Trainee', regular: 'Guard', veteran: 'Senior Guard' },
  sentry: { rookie: 'Sentry', regular: 'Sentry', veteran: 'Lead Sentry' },
  operator: { rookie: 'Junior Operator', regular: 'Operator', veteran: 'Chief Operator' },
  officer: { rookie: 'Sergeant', regular: 'Sergeant', veteran: 'Lieutenant' },
  heavy: { rookie: 'Tactical', regular: 'Tactical Officer', veteran: 'Tactical Lead' },
}

const FEMALE = new Set(['Ana', 'Bea', 'Dana', 'Eva', 'Ines', 'Juno', 'Kira', 'Lena', 'Mara', 'Nadia', 'Rosa', 'Tess', 'Vera', 'Zoe', 'Noor'])

export function rankFor(guard: Guard): string {
  if (guard.armored && guard.role !== 'heavy') return 'Responder'
  return RANKS[guard.role][guard.tier]
}

/** One step up or down the ladder, for a guard who comes back changed. */
export function promote(rank: string, up: boolean): string {
  const ladder = LADDERS.find((rungs) => rungs.includes(rank)) ?? LADDERS[0]
  const at = Math.max(0, ladder.indexOf(rank))
  return ladder[Math.max(0, Math.min(ladder.length - 1, at + (up ? 1 : -1)))]
}

const LADDERS: readonly (readonly string[])[] = [
  ['Night Watchman', 'Trainee', 'Guard', 'Senior Guard', 'Shift Supervisor'],
  ['Night Watchman', 'Sentry', 'Lead Sentry', 'Shift Supervisor'],
  ['Night Watchman', 'Junior Operator', 'Operator', 'Chief Operator'],
  ['Guard', 'Sergeant', 'Lieutenant', 'Captain'],
  ['Guard', 'Tactical', 'Tactical Officer', 'Tactical Lead'],
  ['Guard', 'Responder', 'Response Lead'],
]

export function isFemale(first: string): boolean {
  return FEMALE.has(first)
}

/** He or she, his or her, for lines about this person. */
export function pronouns(person: Pick<Person, 'first'>): { he: string; his: string; him: string } {
  return isFemale(person.first) ? { he: 'she', his: 'her', him: 'her' } : { he: 'he', his: 'his', him: 'him' }
}

function ageFor(rng: Rng, tier: Tier): AgeBand {
  if (tier === 'rookie') return rng() < 0.8 ? '20s' : '30s'
  if (tier === 'regular') return rng() < 0.6 ? '30s' : rng() < 0.5 ? '20s' : '40s'
  return rng() < 0.55 ? '40s' : rng() < 0.6 ? '50s' : '30s'
}

function yearsFor(rng: Rng, tier: Tier): number {
  if (tier === 'rookie') return Math.floor(rng() * 2)
  if (tier === 'regular') return 2 + Math.floor(rng() * 7)
  return 9 + Math.floor(rng() * 16)
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]
}

/** One line of life: where he is from, what he is saving for, a habit, or whose shift he is covering. */
export function lifeLine(rng: Rng, first: string): string {
  const { he, his } = pronouns({ first })
  const roll = rng()
  if (roll < 0.25) return `Grew up in ${pick(rng, TOWNS)}; sends money home every month.`
  if (roll < 0.5) return `Saving for ${pick(rng, SAVING_FOR).replace('his', his)}.`
  if (roll < 0.75) return `${he === 'she' ? 'She' : 'He'} ${pick(rng, HABITS).replace('his', his)}.`
  return `Covering tonight for ${pick(rng, ABSENT)}, ${pick(rng, ABSENT_REASONS)}.`
}

/** Shuffled copy, so names are handed out in a different order on every seed. */
function shuffled<T>(rng: Rng, list: readonly T[]): T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export type NamePool = { surnames: string[]; firsts: string[]; used: Set<string> }

export function namePool(rng: Rng): NamePool {
  return { surnames: shuffled(rng, SURNAMES), firsts: shuffled(rng, FIRST_NAMES), used: new Set() }
}

/** A full name not yet used on this site. A surname is shared only when asked (brothers). */
export function drawName(rng: Rng, pool: NamePool, surname?: string): { first: string; last: string } {
  const last = surname ?? pool.surnames.shift() ?? `${pick(rng, SURNAMES)}-${pick(rng, SURNAMES)}`
  for (let tries = 0; tries < 200; tries += 1) {
    const first = pool.firsts[(tries + pool.used.size) % pool.firsts.length]
    const full = `${first} ${last}`
    // Brothers are brothers.
    if (surname && isFemale(first)) continue
    if (pool.used.has(full)) continue
    pool.used.add(full)
    return { first, last }
  }
  return { first: pick(rng, FIRST_NAMES), last }
}

/** A person on the site's roster: name, rank, age, service, traits and a line of life. */
export function createPerson(rng: Rng, pool: NamePool, id: number, guard: Guard, traits?: TraitId[]): Person {
  const { first, last } = drawName(rng, pool)
  return blankPerson(id, guard, first, last, {
    roster: true, age: ageFor(rng, guard.tier), years: yearsFor(rng, guard.tier),
    traits: traits ?? pickTraits(rng, guard.tier), life: lifeLine(rng, first),
  })
}

/** Someone brought in later (the response team): the radio's own name for him and a rank, nothing more. */
export function createOutsider(id: number, guard: Guard, index: number): Person {
  return blankPerson(id, guard, '', fallbackName(index), { roster: false, age: '30s', years: 0, traits: [], life: '' })
}

export function snapshotOf(guard: Guard): Snapshot {
  return {
    mode: guard.mode, awareness: guard.awareness, shock: guard.shock, hp: guard.hp, stunned: guard.stunSeconds > 0,
    bodies: guard.bodiesSeen.length, restrained: guard.restrained, wait: guard.wait, interest: guard.interest?.kind ?? null,
  }
}

function blankPerson(id: number, guard: Guard, first: string, last: string, rest: Pick<Person, 'roster' | 'age' | 'years' | 'traits' | 'life'>): Person {
  return {
    id, guard, first, last, rank: rankFor(guard), ...rest, memories: [], told: [], act: null, still: { x: guard.x, y: guard.y, since: 0 }, guarding: null, nextActAt: 0, nextTalkAt: 0,
    seen: snapshotOf(guard),
    berserkUntil: -Infinity, returning: null,
    knowledge: { seen: false, named: false, questioned: false, papers: false, traits: [], bonds: [] },
  }
}
