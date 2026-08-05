import { describe, expect, it } from 'vitest'
import { deriveWallRotation, distanceToWall, wallVisualLength } from './wall'

describe('wall geometry', () => {
  it('keeps baseline collision centered and scales rendered length', () => {
    const wall = { x: 0, z: 0 }
    expect(distanceToWall({ x: 0, z: 0.9 }, wall, 1)).toBeCloseTo(0.9)
    expect(wallVisualLength(1.5)).toBeCloseTo(2.625)
  })

  it('extends collision along the same axis as the rendered wall', () => {
    const wall = { x: 0, z: 0 }
    expect(distanceToWall({ x: 0, z: 1 }, wall, 2)).toBeCloseTo(0.125)
    expect(distanceToWall({ x: 1, z: 1 }, wall, 2)).toBeCloseTo(Math.hypot(1, 0.125))
  })

  it('derives the same rotated axis for collision and rendering', () => {
    const map = { id: 'diagonal', name: 'Diagonal', width: 10, depth: 10, pathWidth: 1.5, paths: [[{ x: -4, z: -4 }, { x: 4, z: 4 }]] }
    const rotation = deriveWallRotation(map, { x: 0, z: 0 })
    expect(rotation).toBeCloseTo(-Math.PI / 4)
    expect(distanceToWall({ x: -0.5, z: 0.5 }, { x: 0, z: 0, rotation }, 2)).toBeLessThan(0.01)
    expect(distanceToWall({ x: 0.8, z: 0.8 }, { x: 0, z: 0, rotation }, 2)).toBeGreaterThan(1)
  })
})
