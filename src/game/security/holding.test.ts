import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { enterCombat } from './combat'
import { feetOf } from './model'
import { addGuard, arena, FRAME, GROUND, playerFires, putPlayer, run } from './testArena'

/** Holding a choke point is waiting for a man who is on his way. One who has dug in somewhere is not coming through it. */

describe('holding a choke point', () => {
  it('a holder joining a fight with a man dug in for a while moves up at once instead of waiting at the door', () => {
    const world = arena()
    putPlayer(world, 10)
    // A partition at x 50 with a doorway, and the holder already standing on its near side, where the hold would put him.
    fillTiles(world.grid, 50, GROUND - 6, 50, GROUND - 4, 'brick')
    const front = [24, 26].map((x) => addGuard(world, x, -1))
    // A heavy, so he holds rather than going round.
    const holder = addGuard(world, 52, -1, 'heavy')
    for (const guard of [...front, holder]) guard.hp = guard.maxHp = 1e5
    const spot = { x: 10, y: GROUND - 1 }
    for (const guard of front) enterCombat(world, guard, spot)
    // He only joins when told to, so the shots must not draw him over first.
    holder.deafSeconds = 1e9
    // The man stays put firing from the dark: the front two know where he is but nobody can see him.
    let next = 0
    const fireNow = () => {
      if (world.clock < next) return
      next = world.clock + 0.8
      playerFires(world, { x: 10, y: GROUND - 6 })
    }
    run(world, 5, {}, fireNow)
    expect(world.security.campSeconds).toBeGreaterThan(3)
    enterCombat(world, holder, spot)
    const startX = feetOf(holder).x
    let movedAt = -1
    const joinedAt = world.clock
    run(world, 2.5, {}, () => {
      fireNow()
      if (movedAt < 0 && startX - feetOf(holder).x > 1.5) movedAt = world.clock
    })
    expect(holder.combatRole).toBe('hold')
    expect(movedAt).toBeGreaterThan(0)
    expect(movedAt - joinedAt).toBeLessThan(1.2 + FRAME)
  })
})
