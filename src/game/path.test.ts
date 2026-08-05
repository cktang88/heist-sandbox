import { describe, expect, it } from 'vitest'
import { buildPathInfo, distanceToPath, pointAlongPath } from './path'

const path = [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 3 }]

describe('path helpers', () => {
  it('moves along every segment by total distance', () => {
    const info = buildPathInfo(path)
    expect(info.totalLength).toBe(7)
    expect(pointAlongPath(path, info, 4 / 7)).toEqual({ x: 4, z: 0 })
    expect(pointAlongPath(path, info, 1)).toEqual({ x: 4, z: 3 })
  })

  it('measures placement distance to the nearest segment', () => {
    expect(distanceToPath({ x: 2, z: 2 }, path)).toBe(2)
    expect(distanceToPath({ x: 4.5, z: 2 }, path)).toBe(0.5)
  })
})
