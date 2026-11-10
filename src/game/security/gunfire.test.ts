import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { createWorld, type World } from '../world'
import { exposedTo } from './lineOfFire'
import { feetOf, type Guard } from './model'
import { addGuard, addUpperFloor, arena, GROUND, playerFires, playerHand, putPlayer, run } from './testArena'

/**
 * Gunfire is a target. The owner's complaint: "they should aim directly at gunfire sounds, esp if I'm firing
 * through a floor hole; they just stand there."
 */

const HOLE = { from: 40, to: 42 }

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

  it('on the real complex: an office guard fired on through a hole in his ceiling does the same', () => {
    const world = createWorld(1, 'complex')
    // Floor 104 of the tower is an office (x 143..159); the server room above it has its floor at row 98.
    fillTiles(world.grid, 149, 98, 151, 98, 'air')
    world.structureChanged = true
    putPlayer(world, 152.6, 98)
    world.player.hp = 1e6
    const target = world.guards[14]
    Object.assign(target, { x: 146 - target.w / 2, y: 104 - target.h - 0.01, vx: 0, vy: 0, hp: 1e5, maxHp: 1e5 })
    const seen = fireDownAt(world, target, 98, 10)
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
})
