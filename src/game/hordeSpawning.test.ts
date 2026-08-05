import { describe, expect, it } from 'vitest'
import { spawnPointForEnemy, spawnRankSize } from './combat'
import { ASH_FIELDS, BROKEN_CITADEL, FROZEN_PASS, GREEN_MARCH, SHATTERED_EXPANSE, TWIN_FORK } from './maps'

describe('horde spawn fronts', () => {
  it('fits more orcs side by side on wider roads', () => {
    expect(spawnRankSize(FROZEN_PASS)).toBe(2)
    expect(spawnRankSize(TWIN_FORK)).toBe(2)
    expect(spawnRankSize(BROKEN_CITADEL)).toBe(2)
    expect(spawnRankSize(GREEN_MARCH)).toBe(3)
    expect(spawnRankSize(ASH_FIELDS)).toBe(4)
    expect(spawnRankSize(SHATTERED_EXPANSE)).toBe(8)
  })

  it('offsets a corridor rank across the authored road', () => {
    const first = spawnPointForEnemy(ASH_FIELDS, 0, 0)
    const fourth = spawnPointForEnemy(ASH_FIELDS, 0, 3)
    expect(Math.hypot(first.x - fourth.x, first.z - fourth.z)).toBeCloseTo(1.56)
  })

  it('uses almost the entire entrance edge on an open battlefield', () => {
    const slots = spawnRankSize(SHATTERED_EXPANSE) * SHATTERED_EXPANSE.paths.length
    const points = Array.from({ length: slots }, (_, ordinal) => spawnPointForEnemy(SHATTERED_EXPANSE, ordinal % 3, ordinal))
    const z = points.map((point) => point.z)
    expect(Math.min(...z)).toBeLessThan(-5.5)
    expect(Math.max(...z)).toBeGreaterThan(5.5)
    expect(new Set(z.map((value) => value.toFixed(3))).size).toBe(slots)
  })
})
