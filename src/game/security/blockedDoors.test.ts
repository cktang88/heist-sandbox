import { describe, expect, it } from 'vitest'
import { addProp } from '../hazards/testWorld'
import { loosen } from '../physprops/state'
import { fillTiles, tileAt } from '../tiles'
import type { World } from '../world'
import { enterCombat } from './combat'
import { feetOf, setMode, type Guard } from './model'
import { addGuard, addUpperFloor, addWall, arena, GROUND, putPlayer, run } from './testArena'

/** A door held shut by furniture: go round when that is not much longer, shove it otherwise, and in a fight breach it. */

const DOOR = 50

/** A wall at x 50 with a door in it, a vending machine shoved against its far side. */
function barricade(world: World): void {
  addWall(world, DOOR)
  fillTiles(world.grid, DOOR, GROUND - 3, DOOR, GROUND - 1, 'door')
  loosen(world, addProp(world, 'vendingMachine', DOOR + 1, GROUND))
}

/** The same, with an upper floor and a staircase on each side of the wall (x 40-44 and 56-60). */
function barricadeWithStairs(): World {
  const world = arena()
  barricade(world)
  const upper = addUpperFloor(world, 0, 120)
  world.stairwells.push(
    { id: 0, building: 'site', leftX: 40, rightX: 44, stops: [GROUND, upper] },
    { id: 1, building: 'site', leftX: 60, rightX: 56, stops: [GROUND, upper] },
  )
  return world
}

function investigator(world: World, x: number, goal: { x: number; y: number }): Guard {
  const guard = addGuard(world, x, 1, 'patrol')
  setMode(guard, 'investigating')
  guard.interest = { at: goal, kind: 'noise', priority: 4, reached: false }
  return guard
}

describe('doors held shut by furniture', () => {
  it('with stairs either side, he goes round by the floor above instead of shoving', () => {
    const world = barricadeWithStairs()
    putPlayer(world, 110, GROUND - 6)
    const guard = investigator(world, 46, { x: 66, y: GROUND })
    let wentUp = false
    run(world, 20, {}, () => {
      if (feetOf(guard).y < GROUND - 3) wentUp = true
      return feetOf(guard).x > 62 && Math.abs(feetOf(guard).y - GROUND) < 0.3
    })
    expect(wentUp).toBe(true)
    expect(feetOf(guard).x).toBeGreaterThan(62)
    expect(tileAt(world.grid, DOOR, GROUND - 2)).toBe('door')
  })

  it('with no other way, he shoves it open', () => {
    const world = arena()
    barricade(world)
    putPlayer(world, 110)
    const guard = investigator(world, 46, { x: 66, y: GROUND })
    // The furniture skids off hard when the door gives; this test is about getting through.
    guard.hp = guard.maxHp = 1e5
    run(world, 15, {}, () => feetOf(guard).x > 52)
    expect(feetOf(guard).x).toBeGreaterThan(52)
  })

  it('in a fight a heavy shoots through it rather than shoving', () => {
    const world = arena()
    barricade(world)
    putPlayer(world, 58)
    const heavy = addGuard(world, 46, 1, 'heavy')
    heavy.hp = heavy.maxHp = 1e5
    heavy.flashCooldown = 1e9
    enterCombat(world, heavy, { x: 58, y: GROUND - 1 })
    const magazine = heavy.rounds
    run(world, 4)
    expect(heavy.doorPlan?.choice).toBe('breach')
    expect(heavy.rounds + (heavy.reloadSeconds > 0 ? magazine : 0)).toBeLessThan(magazine - 2)
  })

  it('in a fight a man with a pistol calls a heavy over to breach it', () => {
    const world = arena()
    barricade(world)
    putPlayer(world, 58)
    const guard = addGuard(world, 46, 1)
    const heavy = addGuard(world, 20, 1, 'heavy')
    for (const man of [guard, heavy]) {
      man.hp = man.maxHp = 1e5
      man.flashCooldown = 1e9
      enterCombat(world, man, { x: 58, y: GROUND - 1 })
    }
    heavy.deafSeconds = 1e9
    run(world, 3, {}, () => heavy.breachAt !== null)
    expect(heavy.breachAt).toEqual({ x: DOOR, y: expect.any(Number) })
  })
})
