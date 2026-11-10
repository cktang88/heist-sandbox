import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { enterCombat } from './combat'
import { throwGuardFrag } from './guardFrags'
import { feetOf } from './model'
import { addGuard, addLamp, arena, GROUND, putPlayer, run, killInFight } from './testArena'

/** A guard's own frag is not the intruder's: colleagues know whose it was, and heavies use frags to clear a covered doorway. */

describe("guards' frags", () => {
  it('a frag thrown by a guard does not tell his colleagues the intruder is where it went off', () => {
    const world = arena()
    putPlayer(world, 10)
    const heavy = addGuard(world, 52, 1, 'heavy')
    const near = addGuard(world, 61, -1)
    for (const guard of [heavy, near]) {
      guard.hp = guard.maxHp = 1e5
      enterCombat(world, guard, { x: 10, y: GROUND - 1 })
    }
    // Blinded, so he cannot dive clear and the blast reaches him.
    near.blindSeconds = 10
    throwGuardFrag(world, heavy, { x: 59, y: GROUND - 0.5 })
    run(world, 3.5)
    expect(world.frags.length).toBe(0)
    expect(near.hp).toBeLessThan(near.maxHp)
    expect(Math.abs(near.lastKnown!.x - 10)).toBeLessThan(3)
  })

  it('a heavy clears a doorway where colleagues died with a frag when none of his men is near it', () => {
    const world = arena()
    fillTiles(world.grid, 40, GROUND - 6, 40, GROUND - 4, 'brick')
    putPlayer(world, 50)
    addLamp(world, 50)
    for (const x of [39.6, 40.6]) killInFight(world, x, { x: 50, y: GROUND - 1 })
    const heavy = addGuard(world, 30, 1, 'heavy')
    heavy.hp = heavy.maxHp = 1e5
    enterCombat(world, heavy, { x: 50, y: GROUND - 1 })
    let fragged = false
    run(world, 8, {}, () => {
      if (world.frags.length > 0) fragged = true
      return fragged
    })
    expect(fragged).toBe(true)
  })

  it('with a colleague by the doorway he uses a flashbang or smoke instead', () => {
    const world = arena()
    fillTiles(world.grid, 40, GROUND - 6, 40, GROUND - 4, 'brick')
    putPlayer(world, 50)
    addLamp(world, 50)
    for (const x of [39.6, 40.6]) killInFight(world, x, { x: 50, y: GROUND - 1 })
    const heavy = addGuard(world, 30, 1, 'heavy')
    const wounded = addGuard(world, 38, 1)
    wounded.stunSeconds = 1e9
    heavy.hp = heavy.maxHp = 1e5
    enterCombat(world, heavy, { x: 50, y: GROUND - 1 })
    let fragged = false
    let cleared = false
    run(world, 8, {}, () => {
      if (world.frags.length > 0) fragged = true
      if (world.hazards.grenades.some((grenade) => grenade.thrower === 'guard')) cleared = true
      return cleared
    })
    expect(fragged).toBe(false)
    expect(cleared).toBe(true)
    expect(feetOf(heavy).x).toBeLessThan(40)
  })
})
