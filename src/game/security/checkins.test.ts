import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { knockOutCold } from '../stealth/bodies'
import { shout, startRadio } from './comms'
import { feetOf } from './model'
import { COMMS } from './tuning'
import { addDevice, addGuard, arena, GROUND, run } from './testArena'

describe('shouts', () => {
  it('a guard running for the alarm button keeps running when a colleague shouts', () => {
    const world = arena()
    addDevice(world, { kind: 'radioRelay', x: 5, y: GROUND - 3, disabled: true })
    addDevice(world, { kind: 'alarmButton', x: 40, y: GROUND - 2 })
    const runner = addGuard(world, 60, -1)
    const shouter = addGuard(world, 64, -1)
    startRadio(world, runner, { kind: 'noise', at: { x: 70, y: GROUND - 1 }, loud: true })
    expect(runner.mode).toBe('toAlarm')
    shout(world, shouter, { kind: 'sighting', at: { x: 80, y: GROUND - 1 }, by: 1 })
    run(world, 15, {}, () => world.security.level >= 3)
    expect(world.security.level).toBeGreaterThanOrEqual(3)
  })
})

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
