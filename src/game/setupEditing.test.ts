import { describe, expect, it } from 'vitest'
import { beginPlacementMove, cancelPlacementMove, getPlacementTargeting, placeMovedPlacement, removeSetupPlacement, rotateWallPlacement, setPlacementTargeting } from './setupEditing'
import type { Placement } from './types'

const gunner: Placement = { id: 1, kind: 'gunner', x: 2, z: 3, targetingRule: 'strongest' }
const wall: Placement = { id: 2, kind: 'wall', x: 4, z: 5, rotation: 0.25 }

describe('setup editing', () => {
  it('removes one selected placement for a full-refund sell', () => {
    expect(removeSetupPlacement([gunner, wall], gunner.id)).toEqual([wall])
  })

  it('moves a placement without losing its identity or settings', () => {
    const move = beginPlacementMove([gunner, wall], gunner.id)!
    expect(placeMovedPlacement(move.placements, move.held, { x: 8, z: 9 })).toContainEqual({
      ...gunner, x: 8, z: 9,
    })
    expect(cancelPlacementMove(move.placements, move.held)).toEqual([wall, gunner])
  })

  it('rotates only walls in quarter turns', () => {
    expect(rotateWallPlacement(wall).rotation).toBeCloseTo(0.25 + Math.PI / 2)
    expect(rotateWallPlacement(gunner)).toBe(gunner)
  })

  it('defaults targeting to closest and updates tower targeting only', () => {
    expect(getPlacementTargeting({ ...gunner, targetingRule: undefined })).toBe('closest')
    expect(setPlacementTargeting([gunner, wall], gunner.id, 'densest')[0].targetingRule).toBe('densest')
    expect(setPlacementTargeting([gunner, wall], wall.id, 'weakest')[1]).toBe(wall)
  })
})
