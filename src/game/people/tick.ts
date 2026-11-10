import { isActive, feetOf, type Guard } from '../security/model'
import { sameFloor } from '../security/places'
import type { World } from '../world'
import { bondsOf, otherIn } from './bonds'
import { applyTraits } from './effects'
import { snapshotOf, createOutsider } from './identity'
import { stepIdle } from './idle'
import { watchPlayer } from './knowledge'
import { say } from './lines'
import { noteChanges, noteDeeds, tellStories } from './memory'
import { meetAgain } from './nemesis'
import { coverForFriends, actOnBonds, watchShield } from './relations'
import { renameBarks, renameRecords } from './rename'
import type { ActName, PeopleState, Person } from './types'

/**
 * The people layer's frame. Each person is looked at about four times a second, a few per frame in turn, so the
 * cost stays flat however many guards there are; the site-wide checks (shield, radio cover, names) run four times
 * a second too.
 */

export const TICK = 0.25

export function stepPeople(world: World, dt: number): void {
  const people = world.people
  if (!people) return
  refreshActive(world, people)
  const persons = people.persons
  if (persons.length === 0) return
  people.budget += (dt * persons.length) / TICK
  let turns = Math.min(persons.length, Math.floor(people.budget))
  people.budget -= turns
  while (turns > 0) {
    turns -= 1
    const person = persons[people.cursor % persons.length]
    people.cursor = (people.cursor + 1) % persons.length
    if (people.active.has(person.guard)) tickPerson(world, people, person)
  }
  renameBarks(world, people)
  if (world.clock - people.slowAt < TICK) return
  people.slowAt = world.clock
  watchShield(world, people)
  coverForFriends(world, people)
  noteDeeds(world, people)
  renameRecords(world, people)
}

/** Keeps the set of guards still in the game, and names anyone new (the response team) as he arrives. */
function refreshActive(world: World, people: PeopleState): void {
  if (people.activeFrom === world.guards && people.activeCount === world.guards.length) return
  people.activeFrom = world.guards
  people.activeCount = world.guards.length
  people.active = new Set(world.guards)
  world.guards.forEach((guard, index) => {
    if (people.byGuard.has(guard)) return
    const person = createOutsider(people.persons.length, guard, index)
    people.persons.push(person)
    people.byGuard.set(guard, person)
  })
}

function tickPerson(world: World, people: PeopleState, person: Person): void {
  const before = person.seen
  person.seen = snapshotOf(person.guard)
  watchPlayer(world, person)
  if (!person.roster) return
  const known = person.memories.length
  noteChanges(world, people, person, before)
  if (person.guard.mode === 'dead') return
  applyTraits(world, people, person, before, TICK)
  if (person.memories.slice(known).some((memory) => memory.kind === 'falseAlarm')) rivalSneers(world, people, person)
  actOnBonds(world, people, person)
  meetAgain(world, people, person)
  if (person.traits.includes('greedy')) takeTheDeal(world, people, person)
  giveUpStuckDetour(world, person)
  stepIdle(world, people, person)
  tellStories(world, people, person)
  // Changes this tick made (a sharper eye, a longer pause) are his own; the next tick compares against them.
  person.seen = snapshotOf(person.guard)
}

const STUCK_SECONDS = 4

/**
 * A calm man walking a detour (his own look into a stairwell, or a walk over to a friend) who has not moved for a
 * few seconds cannot get there: he drops it and carries on with his route.
 */
function giveUpStuckDetour(world: World, person: Person): void {
  const guard = person.guard
  const still = person.still
  if (Math.abs(guard.x - still.x) + Math.abs(guard.y - still.y) > 0.3 || guard.wait > 0) {
    person.still = { x: guard.x, y: guard.y, since: world.clock }
    return
  }
  if (guard.mode === 'calm' && guard.detour && !guard.stairs && world.clock - still.since > STUCK_SECONDS) guard.detour = null
}

/** A rival nearby makes sure everyone hears about another false alarm. */
function rivalSneers(world: World, people: PeopleState, person: Person): void {
  for (const bond of bondsOf(people.bonds, person.id)) {
    if (bond.kind !== 'rivals') continue
    const rival = people.persons[otherIn(bond, person.id)]
    if (!isActive(rival.guard) || !sameFloor(feetOf(rival.guard), feetOf(person.guard)) || Math.abs(rival.guard.x - person.guard.x) > 20) continue
    say(world, people, rival, 'rivalFalseAlarm', { about: person })
    return
  }
}

const DEAL_REACH = 3

/** Greedy and given up, with the man right there: he offers a deal, and keeps it (he never goes back for his gun). */
function takeTheDeal(world: World, people: PeopleState, person: Person): void {
  const guard = person.guard
  if (guard.mode !== 'surrendered' || guard.restrained) return
  const close = Math.abs(guard.x - world.player.x) < DEAL_REACH && Math.abs(guard.y - world.player.y) < 2
  if (close && !person.told.includes('surrendered')) {
    person.told.push('surrendered')
    if (say(world, people, person, 'greedy', {}, true) && !person.knowledge.traits.includes('greedy')) person.knowledge.traits.push('greedy')
  }
  if (person.told.includes('surrendered')) guard.unwatchedSeconds = 0
}

/** The idle act a renderer could show for this guard right now, if any. */
export function actOf(world: World, guard: Guard): ActName | null {
  const person = world.people?.byGuard.get(guard)
  return person?.act && world.clock < person.act.until && guard.mode === 'calm' ? person.act.name : null
}

/**
 * How a guard behaves when questioned, for the interrogation code: a loyal man refuses, a greedy or frightened
 * one says more and says it straighter. `line` is what he says instead of answering, when he refuses.
 */
export function talkTerms(world: World, guard: Guard): { refuses: boolean; truthBonus: number; line: string | null } {
  const person = world.people?.byGuard.get(guard)
  if (!person?.roster) return { refuses: false, truthBonus: 0, line: null }
  const traits = person.traits
  if (traits.includes('loyal') && guard.nerve > 0.2) {
    if (!person.knowledge.traits.includes('loyal')) person.knowledge.traits.push('loyal')
    return { refuses: true, truthBonus: 0, line: 'I\'m not telling you anything.' }
  }
  const bonus = (traits.includes('greedy') ? 0.15 : 0) + (traits.includes('coward') ? 0.1 : 0) + (traits.includes('green') ? -0.1 : 0)
  return { refuses: false, truthBonus: bonus, line: null }
}
