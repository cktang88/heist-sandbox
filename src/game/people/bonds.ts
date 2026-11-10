import type { Rng } from '../rng'
import { feetOf } from '../security/model'
import type { Bond, BondKind, Person } from './types'

/**
 * Who knows whom. People who work near each other (the same floor, or one storey apart) are the ones who become friends, rivals or partners; a veteran close to a rookie takes him under his wing. A few
 * share a surname (brothers, made when names are drawn) or are a couple, and some owe each other money.
 */

const NEAR_X = 40
/** Feet rows apart: the same floor, or one storey up or down. */
const NEAR_Y = 6.5
/** Of the pairs that work near each other, the share that has a bond (fewer across floors). */
const BOND_ODDS = 0.5
const OTHER_FLOOR_ODDS = 0.4

/** The kind of bond a pair working near each other has, if any. */
function bondFor(rng: Rng, a: Person, b: Person): BondKind | null {
  const sameFloor = Math.abs(feetOf(a.guard).y - feetOf(b.guard).y) < 1
  if (rng() > BOND_ODDS * (sameFloor ? 1 : OTHER_FLOOR_ODDS)) return null
  const tiers = [a.guard.tier, b.guard.tier]
  if (tiers.includes('veteran') && tiers.includes('rookie') && rng() < 0.6) return 'mentor'
  const both = sameFloor && a.guard.role === 'patrol' && b.guard.role === 'patrol'
  const roll = rng()
  if (both && roll < 0.35) return 'partners'
  if (roll < 0.62) return 'friends'
  if (roll < 0.82) return 'rivals'
  if (roll < 0.94) return 'debt'
  return 'couple'
}

/** Bonds among the roster. At most two per person, so the web stays readable. */
export function makeBonds(rng: Rng, persons: Person[]): Bond[] {
  const bonds: Bond[] = []
  const count = new Map<number, number>()
  const roster = persons.filter((person) => person.roster)
  const free = (person: Person) => (count.get(person.id) ?? 0) < 2
  for (let i = 0; i < roster.length; i += 1) {
    for (let j = i + 1; j < roster.length; j += 1) {
      const a = roster[i]
      const b = roster[j]
      if (!free(a) || !free(b) || !worksNear(a, b) || already(bonds, a.id, b.id)) continue
      const kind = bondFor(rng, a, b)
      if (!kind) continue
      const [first, second] = ordered(kind, a, b)
      bonds.push({ kind, a: first.id, b: second.id })
      count.set(a.id, (count.get(a.id) ?? 0) + 1)
      count.set(b.id, (count.get(b.id) ?? 0) + 1)
    }
  }
  return bonds
}

function worksNear(a: Person, b: Person): boolean {
  const fa = feetOf(a.guard)
  const fb = feetOf(b.guard)
  return Math.abs(fa.y - fb.y) < NEAR_Y && Math.abs(fa.x - fb.x) < NEAR_X
}

function already(bonds: Bond[], a: number, b: number): boolean {
  return bonds.some((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))
}

/** The mentor is the veteran; who owes whom is a coin toss already made by the order of the roster. */
function ordered(kind: BondKind, a: Person, b: Person): [Person, Person] {
  if (kind === 'mentor') return a.guard.tier === 'veteran' ? [a, b] : [b, a]
  return [a, b]
}

/** Bonds that make a man care what happens to the other. */
export const CLOSE: ReadonlySet<BondKind> = new Set(['friends', 'partners', 'mentor', 'brothers', 'couple'])

export function bondsOf(bonds: readonly Bond[], id: number): Bond[] {
  return bonds.filter((bond) => bond.a === id || bond.b === id)
}

export function otherIn(bond: Bond, id: number): number {
  return bond.a === id ? bond.b : bond.a
}

export function bondBetween(bonds: readonly Bond[], a: number, b: number): Bond | undefined {
  return bonds.find((bond) => (bond.a === a && bond.b === b) || (bond.a === b && bond.b === a))
}

/** How one person would describe the other, from his own side of the bond. */
export function describeBond(bond: Bond, from: number): string {
  switch (bond.kind) {
    case 'friends': return 'friend'
    case 'rivals': return 'rival'
    case 'partners': return 'patrol partner'
    case 'mentor': return bond.a === from ? 'rookie he is training' : 'mentor'
    case 'brothers': return 'brother'
    case 'couple': return 'partner (they are together)'
    case 'debt': return bond.a === from ? 'owes money to' : 'is owed money by'
  }
}
