import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { knockOutCold } from '../stealth/bodies'
import { feetOf } from './model'
import { addGuard, arena, run } from './testArena'

describe('a man knocked out', () => {
  it('hurt while out cold, he stays out cold: no fight starts in a limp body', () => {
    const world = arena()
    const guard = addGuard(world, 40, 1)
    knockOutCold(world, guard, 30)
    hurtGuard(world, guard, 10, { x: 10, y: guard.y })
    expect(guard.mode).not.toBe('combat')
    expect(guard.out).toBe(true)
    run(world, 2)
    expect(guard.out).toBe(true)
    expect(guard.mode).not.toBe('combat')
  })

  it('whose radio the player took cannot radio in when he comes round, and his radio in the player\'s pocket no longer rings', () => {
    const world = arena()
    const guard = addGuard(world, 40, 1)
    knockOutCold(world, guard, 1)
    world.stealth.radios.add(world.guards.indexOf(guard))
    run(world, 2)
    expect(guard.out).toBe(false)
    expect(guard.radio).toBeNull()
    guard.checkInAt = world.clock + 0.5
    run(world, 2)
    expect(world.stealth.checkIn).toBeNull()
    expect(feetOf(guard).x).toBeGreaterThan(0)
  })
})
