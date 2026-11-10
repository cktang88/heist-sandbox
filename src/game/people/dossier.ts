import type { World } from '../world'
import { bondBetween, describeBond } from './bonds'
import { callName } from './people'
import { TRAITS } from './traits'
import type { Memory, PeopleState, Person } from './types'

/**
 * The player's file on the guards: one card for each he has seen up close, questioned or searched, holding only
 * what he has learned (a name only once heard or read, traits once shown, bonds once overheard).
 */

export type DossierCard = {
  name: string
  rank: string
  status: string
  /** Age, service and the line of life, once his papers have been read or he has talked. */
  background: string | null
  traits: string[]
  bonds: string[]
  tonight: string[]
  /** "Remembers you from the Blackmoor job", for a returning guard who has said so. */
  history: string | null
}

export function dossier(world: World): DossierCard[] {
  const people = world.people
  if (!people) return []
  return people.persons
    .filter((person) => person.roster && world.guards.includes(person.guard))
    .filter((person) => person.knowledge.seen || person.knowledge.questioned || person.knowledge.papers)
    .map((person) => cardFor(people, person))
}

function cardFor(people: PeopleState, person: Person): DossierCard {
  const knowledge = person.knowledge
  const deep = knowledge.papers || knowledge.questioned
  return {
    name: knowledge.named ? `${person.first} ${person.last}` : 'Name unknown',
    rank: person.rank,
    status: statusOf(person),
    background: deep ? `${person.age}, ${person.years} year${person.years === 1 ? '' : 's'} on the job. ${person.life}` : null,
    traits: knowledge.traits.map((trait) => TRAITS[trait].label),
    bonds: knowledge.bonds.map((id) => bondLine(people, person, people.persons[id])).filter((line): line is string => line !== null),
    tonight: person.memories.map((memory) => memoryLine(people, memory)).filter((line): line is string => line !== null),
    history: person.returning?.greeted ? `Remembers you from the ${person.returning.remembered.site} job (${person.returning.grudge}).` : null,
  }
}

function statusOf(person: Person): string {
  const guard = person.guard
  if (guard.mode === 'dead') return 'dead'
  if (guard.restrained) return 'tied up'
  if (guard.stunSeconds > 0) return 'out cold'
  if (guard.mode === 'surrendered') return 'surrendered'
  if (guard.mode === 'panic') return 'fled'
  return guard.mode === 'calm' ? 'on duty' : 'alert'
}

function bondLine(people: PeopleState, person: Person, other: Person): string | null {
  const bond = bondBetween(people.bonds, person.id, other.id)
  if (!bond) return null
  const name = other.knowledge.named ? callName(people, other) : `a ${other.rank.toLowerCase()}`
  const kind = describeBond(bond, person.id)
  return kind.startsWith('owes') || kind.startsWith('is owed') ? `${kind} ${name}` : `${name}: ${kind}`
}

const MEMORY_WORDS: Partial<Record<Memory['kind'], string>> = {
  knockedOut: 'Knocked out', woke: 'Came round', surrendered: 'Surrendered', spared: 'Was spared', restrained: 'Tied up',
  hostage: 'Held as a human shield', wounded: 'Wounded', sawPlayer: 'Saw you up close', falseAlarm: 'Chased a false alarm',
  berserk: 'Went berserk', brokeDown: 'Broke down', killed: 'Killed',
}

function memoryLine(people: PeopleState, memory: Memory): string | null {
  const minutes = Math.floor(memory.clock / 60)
  const seconds = Math.floor(memory.clock % 60).toString().padStart(2, '0')
  const about = memory.about === undefined ? null : people.persons[memory.about]
  const words = memory.kind === 'friendDied' && about ? `Lost ${callName(people, about)}` : MEMORY_WORDS[memory.kind]
  if (!words) return null
  const reason = (memory.kind === 'berserk' || memory.kind === 'brokeDown') && about ? ` over ${callName(people, about)}` : ''
  return `${minutes}:${seconds} ${words}${reason}`
}
