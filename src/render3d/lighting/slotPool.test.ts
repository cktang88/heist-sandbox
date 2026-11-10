import { describe, expect, it } from 'vitest'
import { FADE_IN, FADE_OUT, SlotPool } from './slotPool'

function frame(pool: SlotPool, offers: [number, number][], dt = 1 / 60): void {
  pool.begin()
  for (const [lamp, score] of offers) pool.offer(lamp, score)
  pool.settle(dt)
}

const held = (pool: SlotPool) => [...pool.lamp].filter((lamp) => lamp >= 0).sort((a, b) => a - b)

describe('SlotPool', () => {
  it('gives its lights to the best offers', () => {
    const pool = new SlotPool(2, 10)
    frame(pool, [[1, 1], [2, 5], [3, 3], [4, 0.5]])
    expect(held(pool)).toEqual([2, 3])
  })

  it('fades a new light in instead of switching it on', () => {
    const pool = new SlotPool(1, 4)
    frame(pool, [[1, 1]], 0.1)
    expect(pool.weight[0]).toBe(0)
    frame(pool, [[1, 1]], 0.1)
    expect(pool.weight[0]).toBeCloseTo(0.1 / FADE_IN)
    for (let step = 0; step < 10; step += 1) frame(pool, [[1, 1]], 0.1)
    expect(pool.weight[0]).toBe(1)
  })

  it('keeps a light on its lamp when a newcomer is only slightly better', () => {
    const pool = new SlotPool(1, 4)
    frame(pool, [[1, 1]])
    frame(pool, [[1, 1], [2, 1.2]])
    expect(held(pool)).toEqual([1])
  })

  it('fades out of a lamp that no longer matters, then hands the light on', () => {
    const pool = new SlotPool(1, 4)
    for (let step = 0; step < 30; step += 1) frame(pool, [[1, 1]])
    frame(pool, [[1, 1], [2, 3]], FADE_OUT / 2)
    expect(held(pool)).toEqual([1])
    expect(pool.weight[0]).toBeCloseTo(0.5)
    frame(pool, [[1, 1], [2, 3]], FADE_OUT / 2 + 0.01)
    expect(held(pool)).toEqual([2])
    expect(pool.moved[0]).toBe(1)
    expect(pool.weight[0]).toBeLessThan(0.1)
  })

  it('lets go of lamps that are no longer offered (switched off or out of range)', () => {
    const pool = new SlotPool(2, 4)
    frame(pool, [[1, 1], [2, 1]])
    for (let step = 0; step < 30; step += 1) frame(pool, [[2, 1]])
    expect(held(pool)).toEqual([2])
  })
})
