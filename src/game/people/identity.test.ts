import { describe, expect, it } from 'vitest'
import { costInReferenceUnits } from '../benchmark'
import { nameOf as fallbackName } from '../security/barks'
import { addGuard, arena, FRAME, run } from '../security/testArena'
import { createWorld } from '../world'
import { clashes } from './traits'
import { fullName, nameOf, personOf } from './people'
import { stepPeople } from './tick'

describe('who the guards are', () => {
  it('every guard on the complex has a full name no one else on the site has, the same every time for a seed', () => {
    const first = createWorld(1, 'complex')
    const again = createWorld(1, 'complex')
    const names = first.guards.map((guard) => fullName(personOf(first, guard)!))
    expect(first.guards.length).toBeGreaterThan(60)
    expect(new Set(names.map((name) => name.split(' ').slice(-2).join(' '))).size).toBe(names.length)
    expect(again.guards.map((guard) => fullName(personOf(again, guard)!))).toEqual(names)
    const other = createWorld(2, 'complex')
    expect(other.guards.map((guard) => fullName(personOf(other, guard)!))).not.toEqual(names)
  })

  it('gives each a rank that fits his role and experience, an age, years of service, two or three traits that fit together, and a line of life', () => {
    const world = createWorld(3, 'complex')
    for (const guard of world.guards) {
      const person = personOf(world, guard)!
      if (guard.role === 'officer') expect(['Sergeant', 'Lieutenant']).toContain(person.rank)
      if (guard.role === 'heavy') expect(person.rank).toMatch(/^Tactical/)
      if (guard.tier === 'rookie') expect(person.years).toBeLessThan(2)
      if (guard.tier === 'veteran') expect(person.years).toBeGreaterThan(8)
      expect(person.traits.length).toBeGreaterThanOrEqual(2)
      expect(person.traits.length).toBeLessThanOrEqual(3)
      for (const a of person.traits) for (const b of person.traits) if (a !== b) expect(clashes(a, b)).toBe(false)
      if (person.traits.includes('green')) expect(guard.tier).toBe('rookie')
      expect(person.life.length).toBeGreaterThan(10)
    }
  })

  it('knows some of his colleagues: friends, rivals, partners, mentors, and brothers who share a surname', () => {
    const world = createWorld(1, 'complex')
    const people = world.people!
    const kinds = new Set([1, 2, 3].flatMap((seed) => createWorld(seed, 'complex').people!.bonds.map((bond) => bond.kind)))
    expect(people.bonds.length).toBeGreaterThan(10)
    for (const kind of ['friends', 'rivals', 'mentor', 'partners'] as const) expect(kinds).toContain(kind)
    for (const bond of people.bonds.filter((each) => each.kind === 'brothers')) expect(people.persons[bond.a].last).toBe(people.persons[bond.b].last)
    for (const bond of people.bonds.filter((each) => each.kind === 'mentor')) {
      expect(people.persons[bond.a].guard.tier).toBe('veteran')
      expect(people.persons[bond.b].guard.tier).toBe('rookie')
    }
  })

  it('answers world.people.nameOf(guard) for the chronicle, with first names for brothers', () => {
    const world = createWorld(1, 'complex')
    const persons = world.people!.persons
    const brothers = persons.filter((person) => persons.some((other) => other !== person && other.last === person.last))
    const single = persons.find((person) => !brothers.includes(person))!
    expect(world.people?.nameOf?.(single.guard)).toBe(nameOf(world, single.guard))
    expect(nameOf(world, single.guard)).toBe(single.last)
    for (const person of brothers) expect(nameOf(world, person.guard)).toBe(person.first)
  })

  it('a guard brought in later (the response team) goes by the radio\'s own name and has no traits', () => {
    const world = arena()
    const guard = addGuard(world, 40, -1)
    run(world, 0.5)
    const person = personOf(world, guard)!
    expect(person.roster).toBe(false)
    expect(person.last).toBe(fallbackName(0))
    expect(person.traits).toEqual([])
  })

  it('costs little: a frame of the people layer on the full complex is a small fraction of the reference workload', () => {
    const world = createWorld(1, 'complex')
    const cost = costInReferenceUnits(() => stepPeople(world, FRAME), 60, 6)
    expect(cost).toBeLessThan(0.5)
  })
})
