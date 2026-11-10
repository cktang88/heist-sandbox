import { describe, expect, it } from 'vitest'
import { alarmPulse, flickerLevel } from './brightness'

describe('flickerLevel', () => {
  it('is the same for the same lamp and moment', () => {
    expect(flickerLevel(7, 12.34)).toBe(flickerLevel(7, 12.34))
  })

  it('is mostly on, but does go dark now and then', () => {
    const samples = Array.from({ length: 6000 }, (_, step) => flickerLevel(3, step / 60))
    const on = samples.filter((level) => level === 1).length / samples.length
    expect(on).toBeGreaterThan(0.75)
    expect(samples).toContain(0)
  })

  it('stutters differently on different lamps', () => {
    const pattern = (seed: number) => Array.from({ length: 600 }, (_, step) => flickerLevel(seed, step / 60)).join()
    expect(pattern(1)).not.toBe(pattern(2))
  })
})

describe('alarmPulse', () => {
  it('swings between dim and bright without going fully dark', () => {
    const samples = Array.from({ length: 200 }, (_, step) => alarmPulse(step / 100))
    expect(Math.min(...samples)).toBeGreaterThan(0.1)
    expect(Math.max(...samples)).toBeGreaterThan(1.3)
  })
})
