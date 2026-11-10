import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { fillTiles } from '../tiles'
import { enterCombat } from './combat'
import { feetOf } from './model'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from './testArena'

/** Where men have been cut down, the next ones do not walk in after them: they clear it first, or wait. */

/** A wall at x 40 with a doorway in it, the player covering it from x 50, and two guards already dead in the doorway. */
function deadlyDoorway() {
  const world = arena()
  fillTiles(world.grid, 40, GROUND - 6, 40, GROUND - 4, 'brick')
  putPlayer(world, 50)
  addLamp(world, 50)
  world.player.hp = 1e6
  for (const x of [39.6, 40.6]) {
    const victim = addGuard(world, x, 1)
    hurtGuard(world, victim, 1e4, { x: 50, y: GROUND - 1 })
  }
  return world
}

describe('kill zones', () => {
  it('two men killed in the same doorway make it one kill zone', () => {
    const world = deadlyDoorway()
    expect(world.security.killZones.length).toBe(1)
    expect(world.security.killZones[0].deaths).toBe(2)
  })

  it('the next guard heading through throws a flashbang or smoke through the doorway before he goes in', () => {
    const world = deadlyDoorway()
    const next = addGuard(world, 30, 1)
    next.hp = next.maxHp = 1e5
    enterCombat(world, next, { x: 50, y: GROUND - 1 })
    let thrownAt = -1
    let enteredAt = -1
    run(world, 12, {}, () => {
      if (thrownAt < 0 && world.hazards.grenades.some((grenade) => grenade.thrower === 'guard')) thrownAt = world.clock
      if (enteredAt < 0 && Math.abs(feetOf(next).x - 40) < 2) enteredAt = world.clock
    })
    expect(thrownAt).toBeGreaterThan(0)
    if (enteredAt >= 0) expect(enteredAt).toBeGreaterThan(thrownAt + 1)
  })

  it('with nothing left to throw he holds at the edge instead of walking in', () => {
    const world = deadlyDoorway()
    const next = addGuard(world, 30, 1)
    next.hp = next.maxHp = 1e5
    next.clearedAt = 1e9
    enterCombat(world, next, { x: 50, y: GROUND - 1 })
    let closest = Infinity
    run(world, 10, {}, () => {
      closest = Math.min(closest, Math.abs(feetOf(next).x - 40))
    })
    expect(closest).toBeGreaterThan(2.4)
  })
})
