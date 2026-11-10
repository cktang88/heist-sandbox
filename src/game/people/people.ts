import { createRng } from '../rng'
import type { Guard } from '../security/model'
import type { World } from '../world'
import { CLOSE, makeBonds } from './bonds'
import { createOutsider, createPerson, drawName, namePool, type NamePool } from './identity'
import type { PeopleState, Person, TraitId } from './types'

/**
 * The people layer: identities for the guards, made once when the site is built and deterministic from the seed.
 * `stepPeople` (step.ts) then nudges public guard state from them; see tick.ts.
 */

const BROTHER_ODDS = 0.06

/** Identities for every guard on the site as built. Pure: the same seed gives the same people. */
export function createPeople(world: World, seed: number): PeopleState {
  const rng = createRng((seed * 2654435761) ^ 0x5eed)
  const pool = namePool(rng)
  const people = blankState(rng, pool)
  for (const guard of world.guards) {
    const person = createPerson(rng, pool, people.persons.length, guard)
    people.persons.push(person)
    people.byGuard.set(guard, person)
  }
  people.bonds = makeBonds(rng, people.persons)
  makeBrothers(people, pool)
  return people
}

function blankState(rng: PeopleState['rng'], pool: NamePool): PeopleState {
  const people: PeopleState = {
    persons: [], byGuard: new Map(), bonds: [], rng, recent: [], cursor: 0, budget: 0,
    mourned: new Set(), covered: new Set(), deeds: new Set(), heist: 0,
    active: new Set(), activeFrom: null, activeCount: -1, shieldWas: null, hesitant: new Set(), lamented: new Set(), slowAt: -Infinity,
    nameOf: (guard) => nameIn(people, guard),
    personOf: (guard) => people.byGuard.get(guard),
  }
  pools.set(people, pool)
  return people
}

const pools = new WeakMap<PeopleState, NamePool>()

/** A few colleagues with a close bond turn out to be brothers: the second takes the first one's surname. */
function makeBrothers(people: PeopleState, pool: NamePool): void {
  for (const bond of people.bonds) {
    if (bond.kind !== 'friends' || people.rng() > BROTHER_ODDS * 4) continue
    const elder = people.persons[bond.a]
    const younger = people.persons[bond.b]
    const renamed = drawName(people.rng, pool, elder.last)
    younger.first = renamed.first
    younger.last = renamed.last
    bond.kind = 'brothers'
  }
}

/**
 * Gives a guard who is not on the roster an identity. A guard brought in later (a responder) only gets a name;
 * tests and scripted scenes can enlist a full person with chosen traits.
 */
export function enlist(world: World, guard: Guard, traits?: TraitId[]): Person {
  const people = world.people!
  const known = people.byGuard.get(guard)
  if (known && (known.roster || !traits)) return known
  const id = people.persons.length
  const pool = pools.get(people) ?? namePool(people.rng)
  const person = traits ? createPerson(people.rng, pool, id, guard, traits) : createOutsider(id, guard, world.guards.indexOf(guard))
  people.persons.push(person)
  people.byGuard.set(guard, person)
  return person
}

/** The identity of a guard, giving late arrivals theirs the first time they are asked about. */
export function personOf(world: World, guard: Guard): Person | undefined {
  if (!world.people) return undefined
  return world.people.byGuard.get(guard) ?? enlist(world, guard)
}

/** What colleagues call him: his surname, or his first name when a brother on site shares it. */
export function nameOf(world: World, guard: Guard): string {
  const person = personOf(world, guard)
  return person ? callName(world.people!, person) : 'him'
}

function nameIn(people: PeopleState, guard: Guard): string {
  const person = people.byGuard.get(guard)
  return person ? callName(people, person) : 'him'
}

export function callName(people: PeopleState, person: Person): string {
  if (!person.first) return person.last
  const shared = people.persons.some((other) => other !== person && other.last === person.last)
  return shared ? person.first : person.last
}

/** Rank and full name, as on his badge. */
export function fullName(person: Person): string {
  return person.first ? `${person.rank} ${person.first} ${person.last}` : `${person.rank} ${person.last}`
}

/** Persons this one has a bond with that makes him care. */
export function closeTo(people: PeopleState, person: Person): Person[] {
  const out: Person[] = []
  for (const bond of people.bonds) {
    if (!CLOSE.has(bond.kind)) continue
    if (bond.a === person.id) out.push(people.persons[bond.b])
    else if (bond.b === person.id) out.push(people.persons[bond.a])
  }
  return out
}
