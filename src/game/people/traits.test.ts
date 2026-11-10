import { describe, expect, it } from 'vitest'
import { frighten } from '../security/nerve'
import { enterCombat } from '../security/combat'
import { addGuard, addLamp, arena, putPlayer, run, runListening } from '../security/testArena'
import { TIMING, TIERS } from '../security/tuning'
import type { World } from '../world'
import { enlist } from './people'
import { TALK } from './lines'
import type { TraitId } from './types'

/** One guard facing the player across a stretch of floor, lit or dark, with the given traits. */
function facing(traits: TraitId[], lit = true, playerX = 31): { world: World; guard: ReturnType<typeof addGuard> } {
  const world = arena()
  const guard = addGuard(world, 40, -1)
  enlist(world, guard, traits)
  putPlayer(world, playerX)
  if (lit) addLamp(world, 31)
  return { world, guard }
}

function awarenessAfter(traits: TraitId[], seconds: number, lit = true): number {
  const { world, guard } = facing(traits, lit, lit ? 31 : 38.2)
  let most = 0
  run(world, seconds, { crouch: lit }, () => {
    most = Math.max(most, guard.awareness)
  })
  return most
}

describe('traits change the numbers the guards already use', () => {
  it('sharp-eyed and jumpy guards fill their awareness faster; a hungover one slower', () => {
    const plain = awarenessAfter([], 0.6)
    expect(awarenessAfter(['sharpEyed'], 0.6)).toBeGreaterThan(plain * 1.2)
    expect(awarenessAfter(['jumpy'], 0.6)).toBeGreaterThan(plain * 1.2)
    expect(awarenessAfter(['hungover'], 0.6)).toBeLessThan(plain * 0.9)
  })

  it('a night-blind guard barely makes out a man in the half-light', () => {
    const plain = awarenessAfter([], 3, false)
    const blind = awarenessAfter(['nightBlind'], 3, false)
    expect(plain).toBeGreaterThan(0)
    expect(blind).toBeLessThan(plain * 0.6)
  })

  it('a trigger-happy guard shoots sooner after "Contact!", a careful one later', () => {
    const draw = (traits: TraitId[]): number => {
      const { world, guard } = facing(traits)
      run(world, 0.3)
      enterCombat(world, guard, { x: 31, y: 29 })
      run(world, 0.3)
      return guard.drawSeconds
    }
    const plain = draw([])
    expect(draw(['triggerHappy'])).toBeLessThan(plain - 0.3)
    expect(draw(['careful'])).toBeGreaterThan(plain)
    expect(plain).toBeLessThanOrEqual(TIMING.drawSeconds * TIERS.regular.draw)
  })

  it('the same fright shakes a coward far more than a brave man, whose fear has a ceiling', () => {
    const shockAfter = (traits: TraitId[]): number => {
      const { world, guard } = facing(traits)
      putPlayer(world, 5)
      run(world, 0.3)
      frighten(guard, 0.3)
      run(world, 0.3)
      frighten(guard, 0.4)
      run(world, 0.3)
      return guard.shock
    }
    const plain = shockAfter([])
    expect(shockAfter(['coward'])).toBeGreaterThan(plain * 1.2)
    expect(shockAfter(['brave'])).toBeLessThanOrEqual(0.45)
    expect(shockAfter(['brave'])).toBeLessThan(plain)
  })

  it('a lazy guard takes longer to go and look at a noise', () => {
    const startsWalking = (traits: TraitId[]): number => {
      const { world, guard } = facing(traits)
      putPlayer(world, 5)
      run(world, 0.3)
      guard.interest = { at: { x: 50, y: 30 }, kind: 'noise', priority: 4, reached: false }
      guard.mode = 'noticed'
      guard.modeSeconds = 0
      guard.state = 'suspicious'
      let at = Infinity
      run(world, 6, {}, () => {
        if (guard.mode === 'investigating' && at === Infinity) at = world.clock
      })
      return at
    }
    expect(startsWalking(['lazy'])).toBeGreaterThan(startsWalking([]) + 1)
  })

  it('a half-deaf guard is deaf for part of every quiet stretch', () => {
    const { world, guard } = facing(['halfDeaf'])
    putPlayer(world, 5)
    let deafFrames = 0
    let frames = 0
    run(world, 10, {}, () => {
      frames += 1
      if (guard.deafSeconds > 0) deafFrames += 1
    })
    expect(deafFrames / frames).toBeGreaterThan(0.25)
    expect(deafFrames / frames).toBeLessThan(0.75)
  })

  it('a clumsy guard trips over things while searching, loud enough for the player to hear where he is', () => {
    const { world, guard } = facing(['clumsy'])
    putPlayer(world, 5)
    run(world, 0.3)
    guard.mode = 'searching'
    const points = Array.from({ length: 20 }, (_, i) => ({ x: i % 2 === 0 ? 60 : 30, y: 30 }))
    guard.search = { points, index: 0, dwell: 0, endsAt: 1e9 }
    const before = world.effects.flashes.length
    let noises = 0
    const heard = runListening(world, 120, {}, () => {
      noises = Math.max(noises, world.effects.flashes.length - before)
    })
    expect(heard.some((line) => (TALK.trip as readonly string[]).includes(line))).toBe(true)
    expect(noises).toBeGreaterThan(0)
  })
})

