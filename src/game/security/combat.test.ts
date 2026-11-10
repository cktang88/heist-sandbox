import { describe, expect, it } from 'vitest'
import { createProps } from '../cover'
import { smokeBetween, throwGrenade } from '../hazards/hazards'
import { colleagueInLine } from './combat'
import { eyeOf, feetOf } from './model'
import { addGuard, addLamp, addWall, arena, GROUND, putPlayer, run } from './testArena'

function litStandoff(guardXs: number[]) {
  const world = arena()
  putPlayer(world, 20)
  addLamp(world, 20)
  const guards = guardXs.map((x) => addGuard(world, x, -1))
  return { world, guards }
}

describe('guard combat', () => {
  it('cannot see through thick smoke from a real smoke grenade', () => {
    const { world, guards } = litStandoff([28])
    world.player.hp = 1e6
    // Dropped between them before the guard turns round to face the player.
    guards[0].facing = 1
    throwGrenade(world, 'smoke', { x: 24, y: GROUND - 1 }, { x: 0, y: 1 })
    run(world, 3.5)
    expect(smokeBetween(world, eyeOf(guards[0]), { x: 20, y: GROUND - 0.8 })).toBeGreaterThan(0.6)
    guards[0].facing = -1
    run(world, 3)
    expect(guards[0].awareness).toBe(0)
    expect(guards[0].mode).not.toBe('combat')
  })

  it('sees the player again once the smoke has thinned away', () => {
    const { world, guards } = litStandoff([28])
    guards[0].facing = 1
    throwGrenade(world, 'smoke', { x: 24, y: GROUND - 1 }, { x: 0, y: 1 })
    run(world, 40, {}, () => guards[0].mode === 'combat')
    expect(guards[0].mode).toBe('combat')
    expect(world.clock).toBeGreaterThan(8)
  })

  it('lets only two guards fire aimed shots at once; the others suppress or hold', () => {
    const { world, guards } = litStandoff([28, 30, 32, 34])
    let mostShooters = 0
    run(world, 6, {}, () => {
      mostShooters = Math.max(mostShooters, world.security.shooters.length)
    })
    expect(guards.every((guard) => guard.mode === 'combat')).toBe(true)
    expect(mostShooters).toBe(2)
    expect(guards.filter((guard) => guard.combatRole === 'assault').length).toBe(2)
    expect(guards.some((guard) => guard.combatRole === 'suppress' || guard.combatRole === 'hold')).toBe(true)
  })

  it('never fires through a colleague', () => {
    const world = arena()
    const shooter = addGuard(world, 30, -1)
    const between = addGuard(world, 26, -1)
    expect(colleagueInLine(world, shooter, { x: 30, y: GROUND - 1.2 }, { x: 20, y: GROUND - 1 })).toBe(true)
    between.y -= 10
    expect(colleagueInLine(world, shooter, { x: 30, y: GROUND - 1.2 }, { x: 20, y: GROUND - 1 })).toBe(false)
  })

  it('takes cover behind furniture on the far side from the player', () => {
    const { world, guards } = litStandoff([31])
    world.props = createProps([{ kind: 'filingCabinet', x: 28, y: GROUND }])
    run(world, 6)
    const feet = feetOf(guards[0])
    expect(guards[0].mode).toBe('combat')
    expect(guards[0].combatRole).toBe('assault')
    expect(feet.x).toBeGreaterThan(28.9)
    expect(feet.x).toBeLessThan(29.6)
  })

  it('falls back when badly hurt', () => {
    const { world, guards } = litStandoff([30])
    run(world, 2.5, {}, () => guards[0].mode === 'combat')
    guards[0].hp = 20
    const before = feetOf(guards[0]).x
    run(world, 2)
    expect(guards[0].combatRole).toBe('fallback')
    expect(feetOf(guards[0]).x).toBeGreaterThan(before + 2)
  })

  it('a heavy flushes a player who stays put with a real flashbang, announced first', () => {
    const world = arena()
    putPlayer(world, 20)
    addLamp(world, 20)
    const heavy = addGuard(world, 30, -1, 'heavy')
    // A colleague round the corner behind a wall, who cannot see the burst.
    const behindWall = addGuard(world, 14, 1)
    addWall(world, 16)
    let barkedAt = -1
    let thrownAt = -1
    run(world, 16, {}, () => {
      if (barkedAt < 0 && world.security.barks.some((line) => line.text.startsWith('Flash'))) barkedAt = world.clock
      if (thrownAt < 0 && world.hazards.grenades.length > 0) thrownAt = world.clock
      return world.player.blindSeconds > 0
    })
    expect(heavy.armored).toBe(true)
    expect(barkedAt).toBeGreaterThan(0)
    expect(thrownAt - barkedAt).toBeGreaterThan(0.9)
    expect(world.player.blindSeconds).toBeGreaterThan(0.5)
    expect(world.player.deafSeconds).toBeGreaterThan(1)
    // The thrower heard his own warning and looked away; the guard behind the wall saw nothing.
    expect(heavy.blindSeconds).toBeLessThan(1)
    expect(behindWall.blindSeconds).toBe(0)
  })

  it('a flashbang the player throws at his own feet blinds the player too', () => {
    const world = arena()
    putPlayer(world, 20)
    throwGrenade(world, 'flash', { x: 20.5, y: GROUND - 1.2 }, { x: 0.2, y: 1 })
    run(world, 2)
    expect(world.player.blindSeconds).toBeGreaterThan(1)
    expect(world.player.deafSeconds).toBeGreaterThan(3)
  })

  it('a flashed guard staggers blind and sees nothing', () => {
    const { world, guards } = litStandoff([26])
    guards[0].blindSeconds = 3
    run(world, 2)
    expect(guards[0].awareness).toBe(0)
    expect(world.security.barks.length).toBeGreaterThan(0)
  })
})
