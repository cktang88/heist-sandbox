import { breakDown } from '../security/fear'
import { setMode, feetOf, isActive, type Tier } from '../security/model'
import { TIERS } from '../security/tuning'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { promote } from './identity'
import { say } from './lines'
import { has } from './memory'
import type { Grudge, PeopleState, Person, Remembered, TraitId } from './types'

/**
 * Guards who lived through meeting the player come back on later heists, on any site. At the end of a heist
 * `rememberHeist` picks the few worth remembering (pure: old list in, new list out; the browser stores it).
 * At the start of the next, `welcomeReturning` puts one or two of them on the new roster, changed by what happened:
 * scarred and vengeful, terrified, grateful, or wary. They say so the first time they lay eyes on the player.
 */

/** At most this many remembered at once; the oldest are dropped. */
export const MAX_REMEMBERED = 5
const MAX_RETURNING = 2
const NOTICE_REACH = 14

/** The most memorable thing that happened to him with the player, if he lived. */
function whatHappened(person: Person): Remembered['what'] | null {
  if (has(person, 'knockedOut') || has(person, 'restrained') || has(person, 'hostage')) return 'humiliated'
  if (has(person, 'wounded')) return 'wounded'
  if (has(person, 'spared') || has(person, 'surrendered')) return 'spared'
  if (has(person, 'sawPlayer')) return 'saw'
  return null
}

const WEIGHT: Record<Remembered['what'], number> = { humiliated: 3, wounded: 3, spared: 2, saw: 1 }

/** The site's short name, as a guard would say it: "Blackmoor". */
export function siteName(world: World): string {
  return world.name.replace(/\s+(Complex|Site|Facility)$/i, '')
}

/** Who to remember from this heist, merged with those remembered before. Pure. */
export function rememberHeist(world: World, before: readonly Remembered[]): Remembered[] {
  const people = world.people
  if (!people) return [...before]
  const heist = Math.max(0, ...before.map((entry) => entry.heist)) + 1
  const site = siteName(world)
  const fresh = people.persons
    .filter((person) => person.roster && person.guard.mode !== 'dead')
    .map((person) => ({ person, what: whatHappened(person) }))
    .filter((entry): entry is { person: Person; what: Remembered['what'] } => entry.what !== null)
    .sort((a, b) => WEIGHT[b.what] - WEIGHT[a.what] || a.person.id - b.person.id)
    .slice(0, MAX_RETURNING)
    .map(({ person, what }): Remembered => ({ first: person.first, last: person.last, rank: person.rank, traits: [...person.traits], site, heist, what }))
  const kept = before.filter((old) => !fresh.some((entry) => entry.first === old.first && entry.last === old.last))
  // Someone who came back and died tonight is gone for good.
  const dead = new Set(people.persons.filter((person) => person.returning && person.guard.mode === 'dead').map((person) => `${person.first} ${person.last}`))
  return [...fresh, ...kept.filter((old) => !dead.has(`${old.first} ${old.last}`))].sort((a, b) => b.heist - a.heist).slice(0, MAX_REMEMBERED)
}

/** What the encounter made of him. */
export function grudgeFor(entry: Remembered, roll: number): Grudge {
  const coward = entry.traits.includes('coward')
  if (entry.what === 'saw') return 'wary'
  if (entry.what === 'spared') return coward || roll < 0.3 ? 'terrified' : 'grateful'
  return coward || roll < 0.25 ? 'terrified' : 'vengeful'
}

const CHANGES: Record<Grudge, { tier: Tier; promoted: boolean; add: TraitId[]; drop: TraitId[] }> = {
  vengeful: { tier: 'veteran', promoted: true, add: ['brave', 'triggerHappy'], drop: ['coward', 'lazy', 'careful', 'greedy'] },
  wary: { tier: 'veteran', promoted: true, add: ['sharpEyed', 'careful'], drop: ['halfDeaf', 'nightBlind', 'lazy', 'jumpy', 'triggerHappy', 'hungover'] },
  terrified: { tier: 'rookie', promoted: false, add: ['jumpy', 'coward'], drop: ['brave', 'careful'] },
  grateful: { tier: 'regular', promoted: false, add: [], drop: ['triggerHappy', 'byTheBook'] },
}

/**
 * Puts one or two remembered guards on tonight's roster, in place of guards stationed where it matters (the one
 * nearest the case first). Call once, right after the world is made.
 */
export function welcomeReturning(world: World, remembered: readonly Remembered[]): Person[] {
  const people = world.people
  if (!people || remembered.length === 0) return []
  people.heist = Math.max(0, ...remembered.map((entry) => entry.heist)) + 1
  const count = Math.min(remembered.length, people.rng() < 0.5 ? 1 : MAX_RETURNING)
  const chosen = [...remembered].sort((a, b) => b.heist - a.heist).slice(0, count)
  const posts = stationsThatMatter(world, people)
  const back: Person[] = []
  chosen.forEach((entry, i) => {
    const person = posts[i]
    if (!person) return
    stationReturning(people, person, entry, grudgeFor(entry, people.rng()))
    back.push(person)
  })
  return back
}

/** Roster guards nearest the case, then officers: where a returning enemy makes the most difference. */
function stationsThatMatter(world: World, people: PeopleState): Person[] {
  const loot = world.loot
  const roster = people.persons.filter((person) => person.roster && person.guard.mode !== 'dead')
  return roster.sort((a, b) => distance(centerOf(a.guard), loot) - distance(centerOf(b.guard), loot))
}

function stationReturning(people: PeopleState, person: Person, entry: Remembered, grudge: Grudge): void {
  // Whoever already had his name on this site gets a new one, so names stay unique.
  for (const other of people.persons) if (other !== person && other.first === entry.first && other.last === entry.last) other.first = `${other.first}-${other.last[0]}`
  const change = CHANGES[grudge]
  person.first = entry.first
  person.last = entry.last
  person.rank = promote(entry.rank, change.promoted)
  person.traits = [...new Set([...entry.traits.filter((trait) => !change.drop.includes(trait)), ...change.add])].slice(-3)
  person.guard.tier = change.tier
  person.guard.nerve = TIERS[change.tier].nerve
  person.returning = { remembered: entry, grudge, greeted: false, lookedAway: false }
  person.life = lifeFor(entry, grudge)
}

function lifeFor(entry: Remembered, grudge: Grudge): string {
  const site = entry.site
  if (grudge === 'vengeful') return `Back from the ${site} job with scars and a promotion. Asked to be put on nights.`
  if (grudge === 'terrified') return `Has not slept properly since ${site}. Demoted after the inquiry.`
  if (grudge === 'grateful') return `Walked away from ${site} alive and knows who let him.`
  return `Studied the ${site} footage frame by frame. Promoted for it.`
}

/**
 * A returning guard meets the player: the first time he sees him he says so, and acts on it: the terrified one
 * breaks, the grateful one looks away once, the others get on with it (their traits already changed).
 */
export function meetAgain(world: World, people: PeopleState, person: Person): void {
  const returning = person.returning
  const guard = person.guard
  if (!returning || !isActive(guard)) return
  const close = distance(centerOf(guard), centerOf(world.player)) < NOTICE_REACH
  if (!returning.greeted && close && (guard.seesPlayer || guard.awareness >= 0.3)) {
    returning.greeted = true
    say(world, people, person, returning.grudge, { site: returning.remembered.site }, true)
    person.knowledge.named = true
    person.knowledge.seen = true
    if (returning.grudge === 'terrified') breakDown(world, guard)
  }
  if (returning.grudge === 'grateful' && returning.greeted && !returning.lookedAway && guard.mode !== 'combat' && guard.awareness > 0) {
    returning.lookedAway = true
    guard.awareness = 0
    guard.interest = null
    guard.facing = feetOf(guard).x > centerOf(world.player).x ? 1 : -1
    if (guard.mode === 'noticed' || guard.mode === 'investigating') setMode(guard, 'calm')
  }
}
