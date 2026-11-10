import { describe, expect, it } from 'vitest'
import { costInReferenceUnits } from '../benchmark'
import { fillTiles } from '../tiles'
import { createWorld } from '../world'
import { MAX_FIRES, stepHazards } from './hazards'
import { startFire } from './fire'
import { bareWorld, run } from './testWorld'

/**
 * Budgets are in reference workloads (see benchmark.ts), not milliseconds, so a busy machine does not fail them.
 * Measured: a quiet site costs about 0.0003 units a frame and a 600-tile fire with its smoke about 1.2 to 2.6
 * (0.3 to 1.1 ms a frame on a 4-core machine running two dozen other jobs). The budgets leave room above that.
 */
const QUIET_BUDGET = 0.01
const BIG_FIRE_BUDGET = 10

describe('hazard cost', () => {
  it('costs next to nothing when nothing is happening', () => {
    const world = createWorld(1)
    expect(costInReferenceUnits(() => stepHazards(world, 1 / 60), 1000)).toBeLessThan(QUIET_BUDGET)
  })

  it('steps a big fire well inside the frame budget', () => {
    const world = bareWorld(300, 204)
    fillTiles(world.grid, 100, 150, 140, 170, 'wood')
    for (let y = 150; y <= 170; y += 1) for (let x = 100; x <= 140; x += 1) startFire(world, x, y, 1)
    expect(world.hazards.fires.size).toBe(MAX_FIRES)
    run(world, 3)
    const cost = costInReferenceUnits(() => stepHazards(world, 1 / 60), 20, 9)
    expect(world.hazards.fires.size).toBeGreaterThan(300)
    expect(world.hazards.smoke!.active.length).toBeGreaterThan(300)
    expect(cost).toBeLessThan(BIG_FIRE_BUDGET)
  })
})
