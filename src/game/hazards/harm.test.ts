import { describe, expect, it } from 'vitest'
import { startFire } from './fire'
import { throwGrenade } from './hazards'
import { addSmoke } from './smoke'
import { bareWorld, box, run } from './testWorld'

/** A bare world with the player standing at x 10 on the ground slab, with ordinary health. */
function standing() {
  const world = bareWorld(40, 20)
  Object.assign(world.player, { x: 9.65, y: 18 - 1.6, vx: 0, vy: 0, hp: 100 })
  return world
}

describe('hazards hurting the player', () => {
  it('burns the player standing in fire', () => {
    const world = standing()
    run(world, 1, () => {
      for (let y = 16; y <= 17; y += 1) for (let x = 9; x <= 10; x += 1) startFire(world, x, y, 1)
    })
    expect(world.player.hp).toBeLessThan(95)
  })

  it('chokes the player in thick fire smoke but not in a smoke grenade cloud', () => {
    const smoky = standing()
    box(smoky, 5, 12, 16, 17)
    run(smoky, 3, () => addSmoke(smoky, 10, 16, 0.2, 'toxic'))
    expect(smoky.player.hp).toBeLessThan(99)

    const screened = standing()
    box(screened, 5, 12, 16, 17)
    throwGrenade(screened, 'smoke', { x: 10, y: 16.5 }, { x: 0, y: 1 })
    run(screened, 5)
    expect(screened.player.hp).toBe(100)
  })
})
