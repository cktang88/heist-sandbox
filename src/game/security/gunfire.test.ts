import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { hasLineOfSight } from '../vision'
import type { World } from '../world'
import { eyeOf, feetOf, type Guard } from './model'
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

/** Could a round from the player's gun reach this guard's head right now? */
const exposed = (world: World, guard: Guard) => hasLineOfSight(world.grid, playerHand(world), eyeOf(guard))

describe('gunfire through a hole in the floor', () => {
  it('the guard shot at from above looks up, fires back up through the hole, and gets out from under it', () => {
    const { world, upper } = holeAbove()
    const target = addGuard(world, 38, -1)
    // Tough enough to live through the test: it is about what he does, not whether he survives.
    target.hp = target.maxHp = 1e5
    let sawAimUp = false
    let shotsUp = 0
    let exposedIdle = 0
    let elapsed = 0
    for (let volley = 0; volley < 40; volley += 1) {
      // A burst at the floor beside him every so often, as a player firing down the hole would.
      if (volley % 4 === 0) playerFires(world, { x: feetOf(target).x + 1.2, y: GROUND - 0.3 })
      run(world, 0.25, {}, () => {
        elapsed += 1 / 60
        sawAimUp ||= target.aim.y < -0.5
        shotsUp = Math.max(shotsUp, guardShotsAbove(world, upper))
        if (elapsed > 3 && exposed(world, target) && !target.peeking && Math.abs(target.vx) < 0.3) exposedIdle += 1 / 60
      })
    }
    expect(target.mode).toBe('combat')
    expect(sawAimUp).toBe(true)
    expect(shotsUp).toBeGreaterThan(0)
    expect(exposedIdle).toBeLessThan(1)
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
