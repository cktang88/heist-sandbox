import { describe, expect, it } from 'vitest'
import type { Guard } from '../guards'
import { createWorld, type World } from '../world'
import { matches } from './describe'
import { createIntel, setupIntel } from './intel'
import { interrogate, interrogateAction, truthOf } from './interrogate'

function freshWorld(seed: number): World {
  const world = createWorld(seed, 'complex')
  world.intel = createIntel()
  setupIntel(world)
  return world
}

/** A guard of a given kind who has given up, posted in a room of `roomKind`, standing next to the player. */
function captive(world: World, traits: Partial<Guard>, roomKind = 'office'): Guard {
  const room = world.rooms.find((candidate) => candidate.kind === roomKind)!
  const guard = world.guards[0]
  Object.assign(guard, { mode: 'surrendered', state: 'suspicious', roomId: room.id, role: 'patrol', tier: 'regular', nerve: 0.5 }, traits)
  Object.assign(world.player, { x: guard.x + 0.8, y: guard.y, vx: 0, vy: 0 })
  // No character of his own (loyal, greedy...) unless a test gives him one.
  const person = world.people?.byGuard.get(guard)
  if (person) person.traits = []
  return guard
}

describe('interrogation', () => {
  it('a loyal man refuses to talk: he is marked questioned, says so, and gives no clue', () => {
    const world = freshWorld(1)
    const guard = captive(world, {})
    world.people!.byGuard.get(guard)!.traits = ['loyal']
    const before = world.intel.clues.length
    expect(interrogate(world, guard)).toBeNull()
    expect(world.intel.questioned.has(guard)).toBe(true)
    expect(world.intel.clues.length).toBe(before)
    expect(world.security.barks.some((line) => line.text.includes('not telling'))).toBe(true)
  })

  it('nobody can be questioned while out cold or shut in a cupboard', () => {
    const world = freshWorld(1)
    const guard = captive(world, { mode: 'calm', restrained: true, out: true })
    expect(interrogateAction(world)).toBeNull()
    guard.out = false
    expect(interrogateAction(world)?.prompt).toBe('Hold E: interrogate')
  })

  it('gets the truth about 70% of the time from an ordinary guard', () => {
    const world = freshWorld(1)
    const guard = captive(world, {})
    const tries = 3000
    let right = 0
    for (let attempt = 0; attempt < tries; attempt += 1) {
      world.intel.questioned.clear()
      if (interrogate(world, guard)!.about === world.intel.real) right += 1
    }
    expect(right / tries).toBeGreaterThan(0.66)
    expect(right / tries).toBeLessThan(0.74)
  })

  it('a wrong answer always names another real candidate place, and describes it correctly', () => {
    const world = freshWorld(3)
    const guard = captive(world, {})
    let wrong = 0
    for (let attempt = 0; attempt < 300; attempt += 1) {
      world.intel.questioned.clear()
      const clue = interrogate(world, guard)!
      const place = world.intel.places[clue.about]
      expect(place).toBeDefined()
      expect(matches(clue.filter, place)).toBe(true)
      if (clue.about !== world.intel.real) wrong += 1
    }
    expect(wrong).toBeGreaterThan(30)
  })

  it('a rookie on the perimeter only knows the building; a veteran operator in the security room knows the room', () => {
    const world = freshWorld(1)
    const rookie = captive(world, { tier: 'rookie', roomId: null })
    const vague = interrogate(world, rookie)!
    expect(Object.keys(vague.filter).filter((key) => vague.filter[key as keyof typeof vague.filter] !== undefined)).toEqual(['building'])

    const veteran = captive(world, { tier: 'veteran', role: 'operator', nerve: 0.8 }, 'security')
    expect(interrogate(world, veteran)!.filter.place).toBeDefined()
  })

  it('frightened people are more truthful than steady veterans, and rookies outside are guessing', () => {
    const world = freshWorld(1)
    const frightened = truthOf(world, captive(world, { nerve: 0.1 }))
    const veteran = truthOf(world, captive(world, { tier: 'veteran', nerve: 0.9 }))
    const guessing = truthOf(world, captive(world, { tier: 'rookie', roomId: null, nerve: 0.5 }))
    expect(frightened).toBeGreaterThan(0.75)
    expect(veteran).toBeLessThan(0.6)
    expect(guessing).toBeLessThan(0.6)
  })

  it('is a held E action that makes the guard talk once; afterwards he has nothing more to say', () => {
    const world = freshWorld(1)
    const guard = captive(world, {})
    const action = interrogateAction(world)!
    expect(action.prompt).toBe('Hold E: interrogate')
    expect(action.hold).toBeGreaterThan(1)
    action.run()
    expect(world.intel.clues).toHaveLength(1)
    expect(world.security.barks.at(-1)?.text.length).toBeGreaterThan(5)
    // Not tied yet: E goes back to tying him up.
    expect(interrogateAction(world)).toBeNull()
    guard.restrained = true
    const again = interrogateAction(world)!
    expect(again.prompt).toBe('E: question again')
    again.run()
    expect(world.intel.clues).toHaveLength(1)
    expect(world.security.barks.at(-1)?.text).toBe('I told you everything!')
  })

  it('works on a human shield and a tied-up guard, but not on the dead or on a guard still on his feet', () => {
    const world = freshWorld(1)
    const guard = captive(world, { mode: 'calm', state: 'patrol' })
    expect(interrogateAction(world)).toBeNull()
    world.melee.shield = guard
    expect(interrogateAction(world)?.prompt).toBe('Hold E: interrogate')
    world.melee.shield = null
    guard.restrained = true
    expect(interrogateAction(world)?.prompt).toBe('Hold E: interrogate')
    Object.assign(guard, { mode: 'dead', state: 'dead' })
    expect(interrogateAction(world)).toBeNull()
  })

  it('makes noise that nearby guards can hear', () => {
    const world = freshWorld(1)
    const guard = captive(world, {})
    const listener = world.guards[1]
    Object.assign(listener, { x: guard.x + 3, y: guard.y, mode: 'calm', state: 'patrol', deafSeconds: 0, stunSeconds: 0 })
    interrogate(world, guard)
    expect(listener.mode).not.toBe('calm')
  })
})
