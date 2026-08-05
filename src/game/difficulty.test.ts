import { describe, expect, it } from 'vitest'
import { applyDifficultyToWave, getRunDifficulty } from './difficulty'

describe('difficulty tiers', () => {
  it('composes tier multipliers with authored wave scaling', () => {
    const wave = { groups: [], intermission: 1, multipliers: { health: 2, speed: 1.1, damage: 1.5 } }
    const veteran = applyDifficultyToWave(wave, 'veteran').multipliers!
    const cadet = applyDifficultyToWave(wave, 'cadet').multipliers!
    expect(veteran.health).toBeCloseTo(2.7)
    expect(veteran.speed).toBeCloseTo(1.188)
    expect(veteran.damage).toBeCloseTo(1.95)
    expect(cadet.health).toBeCloseTo(1.6)
    expect(cadet.speed).toBeCloseTo(0.99)
    expect(cadet.damage).toBeCloseTo(1.125)
  })

  it('keeps old run data on the Standard baseline', () => {
    expect(getRunDifficulty({ mode: 'endless' })).toBe('standard')
  })
})
