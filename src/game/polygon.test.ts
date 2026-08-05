import { describe, expect, it } from 'vitest'
import { distanceToPolygon, distanceToPolygonBoundary, pointInPolygon, polygonArea } from './polygon'

const square = [{ x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }, { x: -1, z: 1 }]

describe('polygon geometry', () => {
  it('classifies points without requiring a winding direction', () => {
    expect(pointInPolygon({ x: 0, z: 0 }, square)).toBe(true)
    expect(pointInPolygon({ x: 0, z: 0 }, [...square].reverse())).toBe(true)
    expect(pointInPolygon({ x: 2, z: 0 }, square)).toBe(false)
  })

  it('measures blocker padding and platform-edge clearance', () => {
    expect(distanceToPolygon({ x: 0, z: 0 }, square)).toBe(0)
    expect(distanceToPolygon({ x: 2, z: 0 }, square)).toBeCloseTo(1)
    expect(distanceToPolygonBoundary({ x: 0, z: 0 }, square)).toBeCloseTo(1)
  })

  it('rejects degenerate area through a stable shoelace calculation', () => {
    expect(polygonArea(square)).toBe(4)
    expect(polygonArea([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }])).toBe(0)
  })
})
