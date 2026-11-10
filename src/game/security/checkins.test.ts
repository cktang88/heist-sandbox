import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { knockOutCold } from '../stealth/bodies'
import { feetOf } from './model'
import { COMMS } from './tuning'
import { addGuard, arena, run } from './testArena'

describe('check-ins', () => {
  it('control does not poll a man it already knows is dead', () => {
    const world = arena()
    const victim = addGuard(world, 40, 1)
    // A colleague right beside him sees him fall.
    addGuard(world, 44, -1)
    hurtGuard(world, victim, 1e4, feetOf(victim))
    victim.checkInAt = world.clock + 1
    run(world, 3 + COMMS.pollSeconds)
    expect(world.security.log.filter((line) => line.includes('check in') || line.includes('not answering'))).toEqual([])
  })

  it('a man who came round checks in again, so a second takedown on him is missed too', () => {
    const world = arena()
    const guard = addGuard(world, 40, 1)
    knockOutCold(world, guard, COMMS.pollSeconds + 3)
    guard.checkInAt = world.clock + 0.5
    run(world, 1 + COMMS.pollSeconds)
    expect(world.security.log.some((line) => line.includes('not answering'))).toBe(true)
    run(world, 5)
    expect(guard.out).toBe(false)
    expect(guard.checkInAt).toBeLessThan(world.clock + COMMS.checkInMax + 30)
  })
})
