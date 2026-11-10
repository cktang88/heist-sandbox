import { describe, expect, it } from 'vitest'
import { canWalkAcross } from '../gaps/gaps'
import { setTile } from '../tiles'
import type { World } from '../world'
import { enterCombat } from './combat'
import { guardDropsThrough } from './holeDrop'
import { feetOf, setMode, type Guard } from './model'
import { addGuard, addRoom, addUpperFloor, arena, GROUND, putPlayer, run, killInFight } from './testArena'

/** Holes blasted in a floor are a way down for guards in a fight, taken with care: soften the room below, never into a kill zone. */

const HOLE = 40

/** Two storeys of offices, a staircase at the left end (x 5-9) and a two-tile hole in the upper floor at x 40-41. */
function holedFloor(): { world: World; upper: number } {
  const world = arena()
  const upper = addUpperFloor(world, 0, 120)
  addRoom(world, { kind: 'office', building: 'site', x: 0, w: 120, floorY: upper })
  addRoom(world, { kind: 'office', building: 'site', x: 0, w: 120, floorY: GROUND })
  world.stairwells.push({ id: 0, building: 'site', leftX: 5, rightX: 9, stops: [GROUND, upper] })
  // The slab map is taken before the blast, as at the start of a heist.
  canWalkAcross(world, HOLE, upper)
  setTile(world.grid, HOLE, upper, 'air')
  setTile(world.grid, HOLE + 1, upper, 'air')
  return { world, upper }
}

function upstairsGuard(world: World, upper: number, x: number, role: 'post' | 'heavy' = 'post'): Guard {
  const guard = addGuard(world, x, 1, role, upper)
  guard.hp = guard.maxHp = 1e5
  return guard
}

describe('guards and holes in the floor', () => {
  it('a guard fighting a man on the storey below drops through the nearby hole rather than going round by the stairs', () => {
    const { world, upper } = holedFloor()
    putPlayer(world, 52)
    const guard = upstairsGuard(world, upper, 34)
    enterCombat(world, guard, { x: 52, y: GROUND - 1 })
    let usedStairs = false
    run(world, 8, {}, () => {
      if (guard.stairs) usedStairs = true
      return Math.abs(feetOf(guard).y - GROUND) < 0.3
    })
    expect(Math.abs(feetOf(guard).y - GROUND)).toBeLessThan(0.3)
    expect(usedStairs).toBe(false)
  })

  it('before dropping on him he fires down through the hole', () => {
    const { world, upper } = holedFloor()
    putPlayer(world, 52)
    const guard = upstairsGuard(world, upper, 34)
    enterCombat(world, guard, { x: 52, y: GROUND - 1 })
    const magazine = guard.rounds
    let roundsWhenDropping = -1
    run(world, 8, {}, () => {
      if (roundsWhenDropping < 0 && feetOf(guard).y > upper + 0.5) roundsWhenDropping = guard.rounds
      return roundsWhenDropping >= 0
    })
    expect(roundsWhenDropping).toBeGreaterThanOrEqual(0)
    expect(roundsWhenDropping).toBeLessThan(magazine)
  })

  it('a heavy throws a flashbang down the hole first', () => {
    const { world, upper } = holedFloor()
    putPlayer(world, 52)
    const guard = upstairsGuard(world, upper, 34, 'heavy')
    enterCombat(world, guard, { x: 52, y: GROUND - 1 })
    let flashBeforeDrop = false
    run(world, 8, {}, () => {
      if (feetOf(guard).y > upper + 0.5) return true
      if (world.hazards.grenades.some((grenade) => grenade.kind === 'flash' && grenade.thrower === 'guard')) flashBeforeDrop = true
    })
    expect(flashBeforeDrop).toBe(true)
  })

  it('he does not drop into the room below where colleagues were just killed', () => {
    const { world, upper } = holedFloor()
    putPlayer(world, 60)
    for (const x of [44, 45]) killInFight(world, x, { x: 60, y: GROUND - 1 })
    const guard = upstairsGuard(world, upper, 34)
    enterCombat(world, guard, { x: 60, y: GROUND - 1 })
    let droppedThrough = false
    run(world, 8, {}, () => {
      const feet = feetOf(guard)
      if (Math.abs(feet.x - HOLE - 1) < 1.5 && feet.y > upper + 0.5 && !guard.stairs) droppedThrough = true
    })
    expect(droppedThrough).toBe(false)
  })

  it('walking over that hole on his way elsewhere, he is carried past it, not dropped in', () => {
    const { world, upper } = holedFloor()
    const guard = upstairsGuard(world, upper, HOLE + 1)
    enterCombat(world, guard, { x: 60, y: GROUND - 1 })
    // What a fighting guard heads for: the man's last known position (combat sets it every frame).
    guard.target = guard.lastKnown
    expect(guardDropsThrough(world, guard, upper)).toBe(true)
    for (const x of [44, 45]) killInFight(world, x, { x: 60, y: GROUND - 1 })
    expect(guardDropsThrough(world, guard, upper)).toBe(false)
  })

  it('a patrol whose route crosses the hole walks past it, calm or on alert', () => {
    for (const mode of ['calm', 'caution'] as const) {
      const { world, upper } = holedFloor()
      putPlayer(world, 110, GROUND)
      const guard = addGuard(world, 30, 1, 'patrol', upper)
      guard.route = [{ x: 30, y: upper }, { x: 55, y: upper }]
      setMode(guard, mode)
      guard.interest = { at: { x: 50, y: GROUND }, kind: 'noise', priority: 1, reached: false }
      let lowest = 0
      run(world, 14, {}, () => {
        lowest = Math.max(lowest, feetOf(guard).y)
      })
      expect(lowest).toBeLessThan(upper + 0.5)
    }
  })
})
