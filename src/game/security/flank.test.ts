import { describe, expect, it } from 'vitest'
import type { World } from '../world'
import { enterCombat } from './combat'
import { feetOf } from './model'
import { addGuard, addLamp, addUpperFloor, arena, GROUND, putPlayer, run } from './testArena'

/** "They should always flank": some pin the player from cover, others come at him from another side or storey. */

/** Two storeys joined by a staircase at each end (x 34-38 and 80-84). */
function twoStairs(): { world: World; upper: number } {
  const world = arena()
  const upper = addUpperFloor(world, 0, 120)
  world.stairwells.push(
    { id: 0, building: 'site', leftX: 34, rightX: 38, stops: [GROUND, upper] },
    { id: 1, building: 'site', leftX: 84, rightX: 80, stops: [GROUND, upper] },
  )
  return { world, upper }
}

describe('flanking', () => {
  it('when a fight starts on one floor, one man goes up the near stairs, along, and down the far ones to come at the player from behind', () => {
    const { world, upper } = twoStairs()
    putPlayer(world, 60)
    addLamp(world, 60)
    world.player.hp = 1e6
    const guards = [44, 46, 48, 50].map((x) => addGuard(world, x, 1))
    for (const guard of guards) guard.hp = guard.maxHp = 1e5
    const wentUp = new Set<number>()
    const cameFromBehind = new Set<number>()
    run(world, 30, {}, () => {
      guards.forEach((guard, index) => {
        const feet = feetOf(guard)
        if (Math.abs(feet.y - upper) < 0.5) wentUp.add(index)
        if (wentUp.has(index) && Math.abs(feet.y - GROUND) < 0.5 && feet.x > 62) cameFromBehind.add(index)
      })
      return cameFromBehind.size > 0
    })
    expect(cameFromBehind.size).toBeGreaterThan(0)
    // The rest kept him pinned from the side they started on.
    expect(guards.filter((guard) => feetOf(guard).x < 58 && Math.abs(feetOf(guard).y - GROUND) < 0.5).length).toBeGreaterThanOrEqual(2)
  })

  it('when the player holds the floor above, the flanker takes the staircase that comes out on his far side', () => {
    const { world, upper } = twoStairs()
    putPlayer(world, 60, upper)
    world.player.hp = 1e6
    const guards = [40, 42, 44].map((x) => addGuard(world, x, 1))
    for (const guard of guards) enterCombat(world, guard, { x: 60, y: upper - 1 })
    let flanker = -1
    run(world, 25, {}, () => {
      flanker = guards.findIndex((guard) => guard.combatRole === 'flank' && guard.search !== null)
      return flanker >= 0
    })
    expect(flanker).toBeGreaterThanOrEqual(0)
    const route = guards[flanker].search!.points
    // Up the far staircase (x 80-84), coming out beyond him.
    expect(route.some((point) => Math.abs(point.y - upper) < 0.5 && point.x > 62)).toBe(true)
    expect(route[0].x).toBeGreaterThan(79)
  })
})
