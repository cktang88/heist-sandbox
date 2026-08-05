import { describe, expect, it } from 'vitest'
import { TOWER_KINDS } from './config'
import { getTowerMuzzle, towerMuzzlePoint } from './towerMuzzle'
import type { Placement, TowerKind } from './types'

function tower(kind: TowerKind): Placement & { kind: TowerKind } {
  return { id: 1, kind, x: 0, z: 0, rotation: 0 }
}

describe('tower muzzle definitions', () => {
  it('defines a visible muzzle and color for every tower kind', () => {
    for (const kind of TOWER_KINDS) {
      const muzzle = getTowerMuzzle(kind)
      expect(muzzle.forward).toBeGreaterThanOrEqual(0)
      expect(muzzle.height).toBeGreaterThan(0)
      expect(muzzle.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('starts a Rivet Gun tracer at its barrel tip toward the target', () => {
    expect(towerMuzzlePoint(tower('gunner'), { x: 10, z: 0 })).toEqual({ x: 0.56, y: 0.31, z: 0 })
    expect(towerMuzzlePoint(tower('gunner'), { x: 0, z: 10 })).toEqual({ x: 0, y: 0.31, z: 0.56 })
  })

  it('uses warm ballistic muzzle colors while preserving weapon identity', () => {
    expect(getTowerMuzzle('gunner').color).toBe('#ffd05a')
    expect(getTowerMuzzle('heavyGun').color).toBe('#ff9a32')
    expect(getTowerMuzzle('cryo').color).toBe('#a8f4ff')
  })
})
