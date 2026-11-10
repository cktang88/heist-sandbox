import { describe, expect, it } from 'vitest'
import { arena, putPlayer, run } from './security/testArena'

describe('a stunned player', () => {
  it('has no control while stunned (a slip, a shock) and gets it back once it wears off', () => {
    const world = arena()
    putPlayer(world, 20)
    run(world, 0.3)
    world.player.stunSeconds = 0.6
    const startX = world.player.x
    run(world, 0.5, { right: true })
    expect(Math.abs(world.player.x - startX)).toBeLessThan(0.05)
    run(world, 1, { right: true })
    expect(world.player.x - startX).toBeGreaterThan(1)
  })
})
