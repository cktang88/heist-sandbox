import { describe, expect, it } from 'vitest'
import { stunGuard } from '../guards'
import { addGuard, addLamp, arena, putPlayer, run, runListening } from '../security/testArena'
import { createWorld } from '../world'
import { TALK } from './lines'
import { grudgeFor, MAX_REMEMBERED, rememberHeist, siteName, welcomeReturning } from './nemesis'
import { enlist, personOf } from './people'
import type { Remembered } from './types'

function heistWithAVictim(): ReturnType<typeof arena> {
  const world = arena()
  putPlayer(world, 30)
  const victim = enlist(world, addGuard(world, 40, -1), ['lazy', 'chatty'])
  enlist(world, addGuard(world, 60, -1), [])
  run(world, 0.3)
  stunGuard(victim.guard, 2)
  run(world, 3)
  return world
}

const entry = (heist: number, what: Remembered['what'] = 'humiliated'): Remembered => ({ first: 'Ivo', last: `Kerr${heist}`, rank: 'Guard', traits: ['lazy'], site: 'Blackmoor', heist, what })

describe('a nemesis that lasts between heists', () => {
  it('remembers the guards who met the player and lived, not the ones nothing happened to', () => {
    const world = heistWithAVictim()
    const remembered = rememberHeist(world, [])
    expect(remembered).toHaveLength(1)
    expect(remembered[0]).toMatchObject({ what: 'humiliated', site: siteName(world), heist: 1, traits: ['lazy', 'chatty'] })
  })

  it('keeps only a handful, dropping the oldest', () => {
    const before = [1, 2, 3, 4, 5].map((heist) => entry(heist))
    const after = rememberHeist(heistWithAVictim(), before)
    expect(after).toHaveLength(MAX_REMEMBERED)
    expect(after[0].heist).toBe(6)
    expect(after.some((old) => old.heist === 1)).toBe(false)
  })

  it('is changed by what happened: humiliation makes him vengeful (or terrified), mercy grateful, a close look wary', () => {
    expect(grudgeFor(entry(1, 'humiliated'), 0.9)).toBe('vengeful')
    expect(grudgeFor(entry(1, 'humiliated'), 0.1)).toBe('terrified')
    expect(grudgeFor(entry(1, 'spared'), 0.9)).toBe('grateful')
    expect(grudgeFor(entry(1, 'saw'), 0.5)).toBe('wary')
    expect(grudgeFor({ ...entry(1, 'spared'), traits: ['coward'] }, 0.9)).toBe('terrified')
  })

  it('round trip: remembered on one heist, he returns on another site, promoted or demoted, posted near the case, and speaks to the player', () => {
    const remembered = rememberHeist(heistWithAVictim(), [])
    const world = createWorld(7, 'complex')
    const [back] = welcomeReturning(world, remembered)
    expect(back.first).toBe(remembered[0].first)
    expect(back.last).toBe(remembered[0].last)
    expect(back.rank).not.toBe(remembered[0].rank)
    expect(personOf(world, back.guard)).toBe(back)
    const others = world.people!.persons.filter((person) => person !== back && person.roster)
    expect(others.every((person) => `${person.first} ${person.last}` !== `${back.first} ${back.last}`)).toBe(true)
    // He is the roster guard nearest the case.
    const gap = (x: number, y: number) => Math.hypot(x - world.loot.x, y - world.loot.y)
    expect(others.every((person) => gap(person.guard.x, person.guard.y) >= gap(back.guard.x, back.guard.y))).toBe(true)

    const facing = back.guard.facing
    putPlayer(world, back.guard.x + 0.35 + facing * 4, back.guard.y + back.guard.h)
    addLamp(world, back.guard.x + facing * 4, back.guard.y + back.guard.h)
    back.guard.awareness = 0.5
    const heard = runListening(world, 0.6)
    const grudge = back.returning!.grudge
    const lines = (TALK[grudge] as readonly string[]).map((line) => line.replaceAll('{site}', remembered[0].site))
    expect(heard.some((line) => lines.includes(line))).toBe(true)
    expect(back.returning!.greeted).toBe(true)
  })

  it('a terrified returner breaks on sight; a grateful one looks away, once', () => {
    for (const grudge of ['terrified', 'grateful'] as const) {
      const world = arena()
      const guard = addGuard(world, 40, -1)
      enlist(world, guard, [])
      welcomeReturning(world, [entry(1, grudge === 'terrified' ? 'humiliated' : 'spared')])
      const person = personOf(world, guard)!
      person.returning!.grudge = grudge
      putPlayer(world, 36)
      run(world, 0.3)
      guard.awareness = 0.5
      guard.mode = 'noticed'
      run(world, 0.5)
      if (grudge === 'terrified') expect(['panic', 'surrendered']).toContain(guard.mode)
      else {
        expect(guard.mode).toBe('calm')
        expect(person.returning!.lookedAway).toBe(true)
      }
    }
  })
})
