import { describe, expect, it } from 'vitest'
import { costInReferenceUnits } from '../benchmark'
import { idleInput } from '../input'
import { stepWorld } from '../step'
import { createWorld } from '../world'
import { stepDirector } from './director'
import { EVENTS } from './events/registry'
import { DEAD_STRETCH, decideMood, MIN_GAP, OPENING } from './pacing'
import { targetTension, tensionOf } from './tension'
import { directedWorld, idle } from './testWorld'

describe('the director', () => {
  it('does nothing at all while off: other systems\' tests see an untouched site', () => {
    const world = createWorld(4, 'complex')
    const guards = world.guards.length
    stepDirector(world, 1)
    idle(world, 5)
    expect(world.director.started).toBe(false)
    expect(world.guards.length).toBe(guards)
    expect(world.director.history).toEqual([])
  })

  it('replays the same night for the same seed: same conditions, same events at the same times, same story beats', () => {
    const run = () => {
      const world = directedWorld(21)
      idle(world, 240)
      return { picks: world.director.picks, history: world.director.history, beats: world.chronicle.beats.map((beat) => `${beat.kind}:${beat.t.toFixed(2)}:${beat.detail}`) }
    }
    expect(run()).toEqual(run())
  })

  it('gives different seeds different nights', () => {
    const nights = [31, 32, 33, 34].map((seed) => {
      const world = directedWorld(seed)
      idle(world, 200)
      return `${world.director.picks.join('+')}|${world.director.history.map((record) => record.id).join(',')}`
    })
    expect(new Set(nights).size).toBe(nights.length)
  })

  it('springs events across a long quiet night, never two timed ones within the minimum gap, and never in the opening', () => {
    const world = directedWorld(41, 'complex', [])
    idle(world, 600)
    const history = world.director.history
    expect(history.length).toBeGreaterThanOrEqual(3)
    expect(history[0].at).toBeGreaterThanOrEqual(OPENING)
    for (let index = 1; index < history.length; index += 1) expect(history[index].at - history[index - 1].at).toBeGreaterThanOrEqual(12)
    const timed = history.filter((record) => EVENTS.find((event) => event.id === record.id)?.kind === 'timed')
    for (let index = 1; index < timed.length; index += 1) expect(timed[index].at - timed[index - 1].at).toBeGreaterThanOrEqual(MIN_GAP)
    expect(timed.length).toBeGreaterThanOrEqual(2)
  })

  it('pacing: holds off in the opening and when it is too hot, raises a flat night, releases a tense one', () => {
    const world = directedWorld(5, 'complex', [])
    expect(decideMood(world).why).toBe('opening')
    world.clock = 200
    world.director.lastEventAt = 200 - DEAD_STRETCH
    world.director.signals.lastSeenAt = -Infinity
    expect(tensionOf(world)).toBeLessThan(targetTension(world))
    expect(decideMood(world).mood).toBe('raise')
    world.security.level = 2
    world.director.signals.lastSeenAt = 190
    expect(decideMood(world).mood).toBe('release')
    world.security.level = 4
    expect(decideMood(world)).toEqual({ mood: null, why: 'too hot' })
    world.security.level = 0
    world.director.lastEventAt = 190
    expect(decideMood(world).why).toBe('spacing')
  })

  it('keeps the whole-site step cost flat with the busiest conditions running', () => {
    const world = directedWorld(1, 'complex', ['storm', 'backupPower', 'vipVisit', 'party', 'inspection'])
    idle(world, 60)
    expect(world.status).toBe('playing')
    // Same budget as the idle whole-site frame in heistLoop.test.ts.
    expect(costInReferenceUnits(() => stepWorld(world, idleInput(), 1 / 60), 30, 6)).toBeLessThan(10)
  })
})
