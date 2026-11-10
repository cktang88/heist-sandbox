import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { createWorld } from '../world'
import { MAX_FIRES, stepHazards } from './hazards'
import { startFire } from './fire'
import { bareWorld, run } from './testWorld'

describe('hazard cost', () => {
  it('costs next to nothing when nothing is happening', () => {
    const world = createWorld(1)
    const started = performance.now()
    for (let frame = 0; frame < 10_000; frame += 1) stepHazards(world, 1 / 60)
    expect(performance.now() - started).toBeLessThan(50)
  })

  it('steps a big fire well inside the frame budget', () => {
    const world = bareWorld(300, 204)
    fillTiles(world.grid, 100, 150, 140, 170, 'wood')
    for (let y = 150; y <= 170; y += 1) for (let x = 100; x <= 140; x += 1) startFire(world, x, y, 1)
    expect(world.hazards.fires.size).toBe(MAX_FIRES)
    run(world, 3)
    const started = performance.now()
    run(world, 3)
    const perFrame = (performance.now() - started) / 180
    expect(world.hazards.fires.size).toBeGreaterThan(300)
    expect(world.hazards.smoke!.active.length).toBeGreaterThan(300)
    expect(perFrame).toBeLessThan(2)
  })
})
