import { describe, expect, it } from 'vitest'
import { addDevice, arena, GROUND, putPlayer, run } from './security/testArena'

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

  it('is offered nothing on E while stunned, and the offer comes back with control', () => {
    const world = arena()
    addDevice(world, { kind: 'fusebox', x: 20, y: GROUND - 2, circuit: 1 })
    putPlayer(world, 20.5)
    run(world, 0.1)
    expect(world.prompt).toBe('E: cut power')
    world.player.stunSeconds = 0.5
    run(world, 0.2)
    expect(world.prompt).toBeNull()
    run(world, 0.2, { interact: true, interactPressed: true })
    expect(world.deadCircuits.has(1)).toBe(false)
    run(world, 0.3)
    expect(world.prompt).toBe('E: cut power')
  })
})
