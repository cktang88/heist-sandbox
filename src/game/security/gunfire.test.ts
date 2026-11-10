import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { createWorld, type World } from '../world'
import { floorHoleSpot } from './fightSpots'
import { exposedTo } from './lineOfFire'
import { feetOf, type Guard } from './model'
import { addGuard, addUpperFloor, arena, GROUND, playerFires, playerHand, putPlayer, run } from './testArena'

/**
 * Gunfire is a target. The owner's complaint: "they should aim directly at gunfire sounds, esp if I'm firing
 * through a floor hole; they just stand there."
 */

const HOLE = { from: 40, to: 42 }
const STOREY = 6
const VARIANTS: [number, number][] = [[1, 0], [1, 3], [2, 0], [2, 4], [3, 1], [3, 5]]

/** Two storeys, a hole blasted in the slab between them, and the player upstairs at its edge in the dark. */
function holeAbove(): { world: World; upper: number } {
  const world = arena()
  const upper = addUpperFloor(world, 0, 120)
  fillTiles(world.grid, HOLE.from, upper, HOLE.to, upper, 'air')
  putPlayer(world, 43.6, upper)
  return { world, upper }
}

const guardShotsAbove = (world: World, slab: number) => world.projectiles.filter((shot) => !shot.fromPlayer && shot.y < slab).length

/**
 * Fires a burst down at the floor beside a guard every second for `seconds`, and reports what he did: whether he
 * aimed up, how many of his rounds went up past the slab, and how long he stood still in the open.
 */
function fireDownAt(world: World, guard: Guard, slab: number, seconds: number) {
  let aimedUp = false
  let shotsUp = 0
  let exposedIdle = 0
  let elapsed = 0
  for (let volley = 0; volley < seconds * 4; volley += 1) {
    if (volley % 4 === 0) playerFires(world, { x: feetOf(guard).x + 1.2, y: feetOf(guard).y - 0.3 })
    run(world, 0.25, {}, () => {
      elapsed += 1 / 60
      aimedUp ||= guard.aim.y < -0.5
      shotsUp = Math.max(shotsUp, guardShotsAbove(world, slab))
      if (elapsed > 3 && exposed(world, guard) && !guard.peeking && Math.abs(guard.vx) < 0.3) exposedIdle += 1 / 60
    })
  }
  return { aimedUp, shotsUp, exposedIdle }
}

/** Could a round from the player's gun reach this guard right now (past walls, slabs and furniture, as cover.ts judges it)? */
const exposed = (world: World, guard: Guard) => exposedTo(world, playerHand(world), feetOf(guard), guard.crouching)

describe('gunfire through a hole in the floor', () => {
  it('the guard shot at from above looks up, fires back up through the hole, and gets out from under it', () => {
    const { world, upper } = holeAbove()
    const target = addGuard(world, 38, -1)
    // Tough enough to live through the test: it is about what he does, not whether he survives.
    target.hp = target.maxHp = 1e5
    const seen = fireDownAt(world, target, upper, 10)
    expect(target.mode).toBe('combat')
    expect(seen.aimedUp).toBe(true)
    expect(seen.shotsUp).toBeGreaterThan(0)
    expect(seen.exposedIdle).toBeLessThan(1)
  })

  // Several seeds, each with a few extra random draws first, so the result never hangs on one lucky sequence.
  it.each(VARIANTS)('on the real complex (seed %i, %i extra draws): an office guard fired on through a hole in his ceiling does the same', (seed, burn) => {
    const world = createWorld(seed, 'complex')
    for (let draw = 0; draw < burn; draw += 1) world.rng()
    // A hole in a middle storey's office floor, found from the site; the player upstairs at its edge, the guard below beside it.
    const { hole } = floorHoleSpot(world)
    fillTiles(world.grid, hole.x0, hole.y, hole.x1, hole.y, 'air')
    world.structureChanged = true
    putPlayer(world, hole.x1 + 1.6, hole.y)
    world.player.hp = 1e6
    const target = addGuard(world, hole.x0 - 2, -1, 'post', hole.y + STOREY)
    target.hp = target.maxHp = 1e5
    const seen = fireDownAt(world, target, hole.y, 10)
    expect(target.mode).toBe('combat')
    expect(seen.aimedUp).toBe(true)
    expect(seen.shotsUp).toBeGreaterThan(0)
    expect(seen.exposedIdle).toBeLessThan(1)
  })

  it('a colleague who only heard the shots also turns his gun on the hole instead of wandering over to stand under it', () => {
    const { world } = holeAbove()
    addGuard(world, 38, -1)
    const listener = addGuard(world, 34, -1)
    for (let volley = 0; volley < 3; volley += 1) {
      playerFires(world, { x: 39.2, y: GROUND - 0.3 })
      run(world, 0.4)
    }
    run(world, 1.5)
    expect(listener.mode).toBe('combat')
    expect(listener.aim.y).toBeLessThan(-0.3)
    const under = Math.abs(feetOf(listener).x - (HOLE.from + HOLE.to + 1) / 2) < 1.5
    expect(under).toBe(false)
  })

  it.each([8, 20, 35])('a pistol round at an unaware guard %i tiles away drops him: it is a hit, not a near miss that warns him first', (gap) => {
    const world = arena()
    putPlayer(world, 20)
    const guard = addGuard(world, 20 + gap, 1)
    playerFires(world, { x: guard.x + guard.w / 2, y: guard.y + 0.5 }, 'pistol')
    run(world, 1.5)
    expect(guard.mode).toBe('dead')
  })
})
