import { describe, expect, it } from 'vitest'
import { DEFAULT_MAP } from './maps'
import { DEFAULT_TUNING, TOWER_KINDS } from './config'
import { advanceTowerAim, aimRotation, angleDifference, defaultTowerRotation, getTowerDisplayedRange, isPointWithinTowerArc, normalizeAngle } from './towerFacing'

describe('tower facing', () => {
  it('aims from the placed tower toward the second click', () => {
    expect(aimRotation({ x: 1, z: 1 }, { x: 1, z: 4 })).toBeCloseTo(Math.PI / 2)
    expect(aimRotation({ x: 1, z: 1 }, { x: -2, z: 1 })).toBeCloseTo(Math.PI)
  })

  it('uses one click for location and a second click for direction', () => {
    const first = advanceTowerAim(null, { x: 2, z: 3 })
    expect(first).toEqual({ status: 'aiming', origin: { x: 2, z: 3 } })
    const second = advanceTowerAim(first.origin, { x: 5, z: 3 })
    expect(second).toEqual({ status: 'committed', origin: { x: 2, z: 3 }, rotation: 0 })
  })

  it('normalizes and compares angles across the zero-degree seam', () => {
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(Math.PI * 1.5)
    expect(angleDifference(Math.PI * 2 - 0.1, 0.1)).toBeCloseTo(-0.2)
  })

  it('accepts targets inside +/- half the arc and rejects targets behind it', () => {
    const tower = { x: 0, z: 0, rotation: 0 }
    expect(isPointWithinTowerArc(tower, { x: 4, z: 1 }, 30)).toBe(true)
    expect(isPointWithinTowerArc(tower, { x: 1, z: 4 }, 30)).toBe(false)
    expect(isPointWithinTowerArc(tower, { x: -4, z: 0 }, 360)).toBe(true)
  })

  it('keeps legacy placements without rotation omnidirectional in low-level combat calls', () => {
    expect(isPointWithinTowerArc({ x: 0, z: 0 }, { x: -4, z: 0 }, 30)).toBe(true)
  })

  it('gives legacy saved towers a deterministic direction toward the fortress', () => {
    const tower = { x: -4, z: 2 }
    const fortress = DEFAULT_MAP.paths[0][DEFAULT_MAP.paths[0].length - 1]
    expect(defaultTowerRotation(DEFAULT_MAP, tower)).toBeCloseTo(aimRotation(tower, fortress))
  })

  it('defines a sector for every weapon and keeps the support aura omnidirectional', () => {
    const weapons = TOWER_KINDS.filter((kind) => kind !== 'support')
    expect(weapons.every((kind) => (DEFAULT_TUNING.towers[kind].firingArcDegrees ?? 360) < 360)).toBe(true)
    expect(DEFAULT_TUNING.towers.support.firingArcDegrees).toBe(360)
  })

  it('shows the support aura instead of its placeholder weapon range', () => {
    const support = DEFAULT_TUNING.towers.support
    if (support.attack.kind !== 'support') throw new Error('Expected support tower stats')

    expect(getTowerDisplayedRange(support)).toBe(support.attack.radius)
    expect(getTowerDisplayedRange(support)).not.toBe(support.range)
    expect(getTowerDisplayedRange(DEFAULT_TUNING.towers.gunner)).toBe(DEFAULT_TUNING.towers.gunner.range)
  })
})
