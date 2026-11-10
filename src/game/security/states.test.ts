import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { emitNoise } from '../noise'
import type { GuardMode } from './model'
import { feetOf } from './model'
import { addGuard, addLamp, addWall, arena, putPlayer, run } from './testArena'

describe('guard states', () => {
  it('walks over to a noise, looks around, says nothing is there and goes back to his post', () => {
    const world = arena()
    const guard = addGuard(world, 50, 1)
    emitNoise(world, { x: 58, y: 29 }, 9)
    const modes = new Set<GuardMode>()
    let closest = Infinity
    run(world, 25, {}, () => {
      modes.add(guard.mode)
      closest = Math.min(closest, Math.abs(feetOf(guard).x - 58))
    })
    expect([...modes]).toEqual(expect.arrayContaining(['noticed', 'investigating', 'calm']))
    expect(closest).toBeLessThan(1)
    expect(guard.mode).toBe('calm')
    expect(Math.abs(feetOf(guard).x - guard.home.x)).toBeLessThan(0.8)
    expect(world.security.level).toBe(0)
  })

  it('notices a player in the light, says so, and only opens fire after announcing contact', () => {
    const world = arena()
    putPlayer(world, 20)
    addLamp(world, 20)
    const guard = addGuard(world, 29, -1)
    const timeline: { mode: GuardMode; time: number }[] = []
    let firstShot = -1
    const barksBeforeCombat: string[] = []
    run(world, 6, {}, () => {
      if (timeline.at(-1)?.mode !== guard.mode) timeline.push({ mode: guard.mode, time: world.clock })
      if (guard.mode !== 'combat') barksBeforeCombat.splice(0, barksBeforeCombat.length, ...world.security.barks.map((line) => line.text))
      if (firstShot < 0 && world.projectiles.some((shot) => !shot.fromPlayer)) firstShot = world.clock
    })
    const modes = timeline.map((entry) => entry.mode)
    expect(modes.indexOf('noticed')).toBeGreaterThan(-1)
    expect(modes.indexOf('combat')).toBeGreaterThan(modes.indexOf('noticed'))
    expect(barksBeforeCombat.length).toBeGreaterThan(0)
    const combatAt = timeline.find((entry) => entry.mode === 'combat')!.time
    expect(firstShot).toBeGreaterThan(combatAt + 0.9)
    expect(world.stats.timesSpotted).toBe(1)
  })

  it('searches the last known position, not where the player really went', () => {
    const world = arena()
    putPlayer(world, 40)
    addLamp(world, 40)
    addWall(world, 30)
    const guard = addGuard(world, 48, -1)
    run(world, 4, {}, () => guard.mode === 'combat')
    expect(guard.mode).toBe('combat')
    const seenAt = guard.lastKnown!.x
    putPlayer(world, 20)
    let reached = Infinity
    run(world, 20, {}, () => {
      if (guard.mode === 'searching') reached = Math.min(reached, Math.abs(feetOf(guard).x - seenAt))
    })
    expect(Math.abs(seenAt - 40)).toBeLessThan(1)
    expect(reached).toBeLessThan(1)
    expect(guard.search?.points[0].x ?? seenAt).toBeCloseTo(seenAt, 0)
  })

  it('a found body is radioed in and raises the site alert level', () => {
    const world = arena()
    addLamp(world, 60)
    const victim = addGuard(world, 60, 1)
    const finder = addGuard(world, 50, 1)
    hurtGuard(world, victim, 1000, feetOf(victim))
    let called = false
    run(world, 15, {}, () => {
      called ||= finder.radio !== null
    })
    expect(called).toBe(true)
    expect(world.security.level).toBeGreaterThanOrEqual(2)
    expect(world.security.log.some((line) => line.includes('Man down'))).toBe(true)
  })

  it('killing the caller mid-call stops the report', () => {
    const world = arena()
    addLamp(world, 60)
    const victim = addGuard(world, 60, 1)
    const finder = addGuard(world, 50, 1)
    hurtGuard(world, victim, 1000, feetOf(victim))
    run(world, 15, {}, () => finder.radio !== null)
    expect(finder.radio).not.toBeNull()
    hurtGuard(world, finder, 1000, feetOf(finder))
    run(world, 10)
    expect(world.security.level).toBe(0)
    expect(world.security.log.some((line) => line.includes('Man down'))).toBe(false)
  })
})
