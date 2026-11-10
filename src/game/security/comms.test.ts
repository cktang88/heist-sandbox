import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { stepSecurity } from './dispatch'
import { reportEvent } from './report'
import type { GuardMode } from './model'
import { feetOf } from './model'
import { addDevice, addGuard, addLamp, addRoom, addWall, arena, GROUND, putPlayer, run } from './testArena'

describe('radio, check-ins and the control room', () => {
  it('a missed check-in is polled, then a pair is sent to the silent guard\'s post', () => {
    const world = arena()
    addWall(world, 30)
    const silent = addGuard(world, 20, 1)
    const patrol = addGuard(world, 50, 1, 'patrol')
    const partner = addGuard(world, 56, 1, 'patrol')
    hurtGuard(world, silent, 1000, feetOf(silent))
    silent.checkInAt = world.clock + 1
    run(world, 3)
    expect(world.security.log.some((line) => line.includes('check in'))).toBe(true)
    expect(world.security.level).toBe(0)
    run(world, 10)
    expect(world.security.level).toBe(1)
    expect(world.security.log.some((line) => line.includes('not answering'))).toBe(true)
    expect(patrol.mode).toBe('investigating')
    expect(patrol.interest?.kind).toBe('order')
    expect(patrol.interest!.at.x).toBeCloseTo(silent.home.x, 0)
    expect(partner.follow).toBe(world.guards.indexOf(patrol))
  })

  it('with every radio relay cut, a guard who finds a body cannot report it and runs for the alarm button', () => {
    const world = arena()
    addLamp(world, 60)
    addDevice(world, { kind: 'radioRelay', x: 5, y: GROUND - 3, disabled: true })
    addDevice(world, { kind: 'alarmButton', x: 40, y: GROUND - 2 })
    const victim = addGuard(world, 60, 1)
    const finder = addGuard(world, 50, 1)
    hurtGuard(world, victim, 1000, feetOf(victim))
    const modes = new Set<GuardMode>()
    let levelBeforeButton = -1
    run(world, 30, {}, () => {
      modes.add(finder.mode)
      if (finder.mode === 'toAlarm') levelBeforeButton = world.security.level
      return world.security.level >= 3
    })
    expect(modes.has('toAlarm')).toBe(true)
    expect(levelBeforeButton).toBe(0)
    expect(world.security.level).toBeGreaterThanOrEqual(3)
    expect(world.alarm).toBe(true)
    expect(Math.abs(feetOf(finder).x - 40.5)).toBeLessThan(1)
  })

  it('a camera sighting reaches the control room only if someone is watching the monitors', () => {
    for (const manned of [false, true]) {
      const world = arena()
      addRoom(world, { kind: 'office', building: 'hq', x: 2, w: 60, floorY: GROUND })
      const securityRoom = addRoom(world, { kind: 'security', building: 'hq', x: 100, w: 10, floorY: GROUND })
      addWall(world, 70)
      addDevice(world, { kind: 'camera', x: 12, y: GROUND - 4, roomId: 0, facing: 1 })
      putPlayer(world, 18)
      addLamp(world, 18)
      if (manned) addGuard(world, securityRoom.x + 5, 1, 'operator')
      run(world, 6)
      if (manned) {
        expect(world.security.level).toBeGreaterThanOrEqual(2)
        expect(world.security.lastKnown!.x).toBeCloseTo(18, 0)
      } else {
        expect(world.security.level).toBe(0)
        expect(world.security.lastKnown).toBeNull()
      }
    }
  })

  it('alert levels step down after quiet spells but never back to normal', () => {
    const world = arena()
    putPlayer(world, 5)
    reportEvent(world, { kind: 'sighting', at: { x: 80, y: GROUND - 1 }, by: 0 })
    expect(world.security.level).toBe(3)
    expect(world.alarm).toBe(true)
    for (let second = 0; second < 1200; second += 1) {
      world.clock += 1
      stepSecurity(world, 1)
    }
    expect(world.security.level).toBe(2)
    expect(world.alarm).toBe(false)
  })

  it('a single unease report decays to level 1 and stays there', () => {
    const world = arena()
    addGuard(world, 50, 1, 'patrol')
    reportEvent(world, { kind: 'noise', at: { x: 50, y: GROUND - 1 }, loud: false })
    expect(world.security.level).toBe(1)
    for (let second = 0; second < 600; second += 1) {
      world.clock += 1
      stepSecurity(world, 1)
    }
    expect(world.security.level).toBe(1)
  })
})
