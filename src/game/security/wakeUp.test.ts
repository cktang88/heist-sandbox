import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { knockOutCold } from '../stealth/bodies'
import { feetOf } from './model'
import { surrender } from './fear'
import { addGuard, arena, putPlayer, run } from './testArena'

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

  it('who had given up before he was choked out comes round armed, not drawn empty-handed with his gun still on the floor', () => {
    const world = arena()
    putPlayer(world, 38)
    const guard = addGuard(world, 40, -1)
    surrender(world, guard)
    expect(guard.droppedWeapon).not.toBeNull()
    knockOutCold(world, guard, 1)
    putPlayer(world, 140)
    run(world, 2)
    expect(guard.out).toBe(false)
    expect(guard.mode).not.toBe('surrendered')
    expect(guard.droppedWeapon).toBeNull()
  })
})

