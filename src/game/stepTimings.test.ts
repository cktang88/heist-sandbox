import { afterEach, describe, expect, it } from 'vitest'
import { idleInput } from './input'
import { stepWorld } from './step'
import { enableStepTimings, stepTimings } from './stepTimings'
import { createWorld } from './world'

function play(steps: number): void {
  const world = createWorld(1)
  for (let step = 0; step < steps; step += 1) stepWorld(world, idleInput({ x: world.player.x + 5, y: world.player.y }), 1 / 60)
}

describe('step timings', () => {
  afterEach(() => enableStepTimings(false))

  it('are off by default and record nothing', () => {
    play(5)
    const timings = stepTimings()
    expect(timings.enabled).toBe(false)
    expect(timings.steps).toBe(0)
    expect(timings.slowest).toEqual([])
  })

  it('record each step and name the system that dominated the slowest ones when switched on', () => {
    enableStepTimings(true)
    play(20)
    const timings = stepTimings()
    expect(timings.steps).toBe(20)
    expect(timings.slowest.length).toBeGreaterThan(0)
    const slowest = timings.slowest[0]
    expect(slowest.ms).toBe(timings.worstMs)
    expect(slowest.systemMs).toBeLessThanOrEqual(slowest.ms)
    expect(slowest.system).not.toBe('')
    expect(timings.meanMs).toBeLessThanOrEqual(timings.worstMs)
    expect(performance.getEntriesByName('sim:guards', 'measure').length).toBeGreaterThan(0)
  })

  it('start a fresh record when switched on again', () => {
    enableStepTimings(true)
    play(3)
    enableStepTimings(true)
    expect(stepTimings().steps).toBe(0)
  })
})
