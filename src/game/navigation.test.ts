import { describe, expect, it } from 'vitest'
import { buildNavigationField, sampleNavigation, updateNavigationCache, type NavigationWall } from './navigation'
import { distanceToPath } from './path'
import type { MapDefinition, Point } from './types'

const map: MapDefinition = {
  id: 'navigation-test', name: 'Navigation Test', width: 12, depth: 8, pathWidth: 1.4,
  paths: [[{ x: -6, z: 0 }, { x: 6, z: 0 }]],
}

const partialWall: NavigationWall = { id: 7, x: 0, z: 0, rotation: 0, length: 1, radius: 0.55 }

describe('route-corridor navigation', () => {
  it('reaches the fortress on an open authored path', () => {
    const field = buildNavigationField(map)
    const result = walk(field, map.paths[0][0])
    expect(result.reached).toBe(true)
    expect(result.point.x).toBeGreaterThan(5.4)
  })

  it('keeps ordinary walkable cells inside the painted road', () => {
    const field = buildNavigationField(map)
    for (let row = 0; row < field.rows; row += 1) {
      for (let column = 0; column < field.columns; column += 1) {
        const index = row * field.columns + column
        if (!field.walkable[index]) continue
        const point = {
          x: field.originX + (column + 0.5) * field.cellSize,
          z: field.originZ + (row + 0.5) * field.cellSize,
        }
        expect(distanceToPath(point, map.paths[0])).toBeLessThanOrEqual(map.pathWidth / 2)
      }
    }
  })

  it('detours around a partial temporary wall', () => {
    const field = buildNavigationField(map, [partialWall])
    const result = walk(field, map.paths[0][0])
    expect(result.reached).toBe(true)
    expect(result.maxOffset).toBeGreaterThan(0.55)
  })

  it('identifies the responsible wall when it completely blocks the corridor', () => {
    const completeWall = { ...partialWall, id: 9, length: 3 }
    const sample = sampleNavigation(buildNavigationField(map, [completeWall]), map.paths[0][0])
    expect(sample.reachable).toBe(false)
    expect(sample.blockingWallId).toBe(9)
    expect(sample.direction.x).toBeGreaterThan(0)
  })

  it('routes every lane to a shared fortress', () => {
    const multiLane: MapDefinition = {
      ...map,
      id: 'multi-lane',
      paths: [
        [{ x: -6, z: -2 }, { x: -1, z: -2 }, { x: 2, z: 0 }, { x: 6, z: 0 }],
        [{ x: -6, z: 2 }, { x: -1, z: 2 }, { x: 2, z: 0 }, { x: 6, z: 0 }],
      ],
    }
    const field = buildNavigationField(multiLane)
    expect(multiLane.paths.every((path) => walk(field, path[0]).reached)).toBe(true)
  })

  it('reuses the field while wall topology is unchanged', () => {
    const first = updateNavigationCache(null, map, [partialWall])
    const same = updateNavigationCache(first, map, [{ ...partialWall }])
    const changed = updateNavigationCache(same, map, [{ ...partialWall, z: 0.5 }])
    expect(same).toBe(first)
    expect(same.rebuilds).toBe(1)
    expect(changed).not.toBe(first)
    expect(changed.rebuilds).toBe(2)
  })
})

describe('open-field navigation', () => {
  const openMap: MapDefinition = {
    ...map,
    id: 'open-navigation-test',
    navigationMode: 'open',
    solidPolygons: [{ kind: 'platform', points: [
      { x: -0.8, z: -2.2 }, { x: 0.8, z: -2.2 }, { x: 0.8, z: 2.2 }, { x: -0.8, z: 2.2 },
    ] }],
  }

  it('uses the whole field and routes around solid polygons', () => {
    const field = buildNavigationField(openMap)
    const offAnchor = sampleNavigation(field, { x: -5, z: 3 })
    const result = walk(field, openMap.paths[0][0])
    expect(offAnchor.reachable).toBe(true)
    expect(result.reached).toBe(true)
    expect(result.maxOffset).toBeGreaterThan(2.2)
  })

  it('includes polygon vertices in the topology cache key', () => {
    const first = updateNavigationCache(null, openMap, [])
    const moved = { ...openMap, solidPolygons: [{ ...openMap.solidPolygons![0], points: openMap.solidPolygons![0].points.map((point, index) => index === 0 ? { ...point, x: point.x - 0.2 } : point) }] }
    expect(updateNavigationCache(first, moved, [])).not.toBe(first)
  })
})

function walk(field: ReturnType<typeof buildNavigationField>, start: Point) {
  let point = { ...start }
  let maxOffset = 0
  for (let step = 0; step < 120; step += 1) {
    const sample = sampleNavigation(field, point)
    maxOffset = Math.max(maxOffset, Math.abs(point.z))
    if (sample.atGoal) return { reached: true, point, maxOffset }
    point = sample.next
  }
  return { reached: false, point, maxOffset }
}
