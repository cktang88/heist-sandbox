import { describe, expect, it } from 'vitest'
import { hurtGuard, investigate, stunGuard } from '../guards'
import { nameOf as fallbackName } from '../security/barks'
import { surrender } from '../security/fear'
import { addGuard, arena, GROUND, putPlayer, run, runListening } from '../security/testArena'
import type { World } from '../world'
import { TALK, type TalkKind } from './lines'
import { describeIntruder, noteDeeds } from './memory'
import { callName, enlist } from './people'
import type { Person } from './types'

const MEMORY_TALK: TalkKind[] = ['woke', 'wokeTalk', 'spared', 'sparedVeteran', 'sawPlayer', 'falseAlarmTwice', 'downCount', 'friendGone', 'wounded', 'hostageAfter']

function matches(line: string, kind: TalkKind): boolean {
  return (TALK[kind] as readonly string[]).some((template) => {
    const pattern = template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[a-z]+\}/g, '.+')
    return new RegExp(`^${pattern}$`).test(line)
  })
}

function saidKind(lines: string[], kind: TalkKind): boolean {
  return lines.some((line) => matches(line, kind))
}

function guardAt(world: World, x: number): Person {
  return enlist(world, addGuard(world, x, -1), [])
}

describe('guards remember tonight and talk about it', () => {
  it('a guard choked out comes round groggy, then tells whoever is near what happened', () => {
    const world = arena()
    putPlayer(world, 20)
    const victim = guardAt(world, 40)
    run(world, 0.3)
    stunGuard(victim.guard, 3)
    const heard = runListening(world, 20)
    expect(saidKind(heard, 'woke')).toBe(true)
    expect(saidKind(heard, 'wokeTalk')).toBe(true)
    expect(victim.memories.map((memory) => memory.kind)).toEqual(expect.arrayContaining(['knockedOut', 'woke']))
  })

  it('a guard who gave up and was left alone remembers being spared and says so', () => {
    const world = arena()
    putPlayer(world, 36)
    const man = guardAt(world, 40)
    run(world, 0.3)
    surrender(world, man.guard)
    run(world, 1)
    putPlayer(world, 15)
    const heard = runListening(world, 40)
    expect(man.memories.map((memory) => memory.kind)).toContain('spared')
    expect(saidKind(heard, 'spared') || saidKind(heard, 'sparedVeteran')).toBe(true)
  })

  it('fooled twice by a noise, a guard says he knows the trick', () => {
    const world = arena()
    putPlayer(world, 15)
    const man = guardAt(world, 40)
    run(world, 0.3)
    const heard: string[] = []
    for (let time = 0; time < 2; time += 1) {
      investigate(man.guard, { x: 46, y: GROUND })
      heard.push(...runListening(world, 20))
    }
    heard.push(...runListening(world, 10))
    expect(man.memories.filter((memory) => memory.kind === 'falseAlarm').length).toBe(2)
    expect(saidKind(heard, 'falseAlarmTwice')).toBe(true)
  })

  it('a guard to whom nothing has happened never talks about things that did not happen', () => {
    const world = arena()
    putPlayer(world, 25)
    guardAt(world, 40)
    guardAt(world, 50)
    const heard = runListening(world, 90)
    for (const kind of MEMORY_TALK) expect(saidKind(heard, kind)).toBe(false)
  })

  it('describes the intruder by what the guards have seen him do', () => {
    const world = arena()
    expect(describeIntruder(world, world.people!)).toMatch(/^Masked/)
    world.security.lineNoticed = true
    noteDeeds(world, world.people!)
    expect(describeIntruder(world, world.people!)).toBe('He came up on a grapple line')
  })

  it('calls the dead by their real names on the radio, not the fallback list', () => {
    const world = arena()
    putPlayer(world, 10)
    const witness = guardAt(world, 40)
    const victim = guardAt(world, 44)
    run(world, 0.3)
    const heard = runListening(world, 1, {}, () => {
      if (victim.guard.mode !== 'dead') hurtGuard(world, victim.guard, 1000, { x: 10, y: GROUND - 1 })
    })
    const name = callName(world.people!, victim)
    expect(heard.some((line) => line.includes(name))).toBe(true)
    expect(heard.some((line) => line.includes(fallbackName(1)))).toBe(false)
    expect(witness.guard.mode).not.toBe('dead')
  })
})
