import { describe, expect, it } from 'vitest'
import { createStressStream, scheduleStressSpawns } from './stressStream'

describe('diagnostic horde streaming', () => {
  it('decreases a 50000 total while never filling beyond the 5000 live cap', () => {
    const stream = createStressStream(50_000, 900, 5_000)
    let live = 4_950

    const first = scheduleStressSpawns(stream, 0.1, live)
    live += first
    expect(first).toBe(50)
    expect(live).toBe(5_000)
    expect(stream.remaining).toBe(49_950)

    expect(scheduleStressSpawns(stream, 0.1, live)).toBe(0)
    live -= 125
    const refill = scheduleStressSpawns(stream, 0.1, live)
    live += refill
    expect(refill).toBe(125)
    expect(live).toBe(5_000)
    expect(stream.remaining).toBe(49_825)
  })
})
