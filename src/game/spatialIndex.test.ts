import { describe, expect, it } from 'vitest'
import { EnemySpatialIndex } from './spatialIndex'

type Entity = { id: number; x: number; z: number; alive: boolean }

describe('EnemySpatialIndex', () => {
  it('rebuilds in place for a moving population', () => {
    const first = [{ x: 0, z: 0 }, { x: 6, z: 6 }]
    const index = new EnemySpatialIndex(first, 1)
    expect(index.withinRadius({ x: 0, z: 0 }, 1)).toEqual([first[0]])

    const second = [{ x: 4, z: 4 }, { x: 4.2, z: 4 }]
    index.rebuild(second)

    expect(index.withinRadius({ x: 4, z: 4 }, 1)).toEqual(second)
    expect(index.telemetry()).toMatchObject({ entities: 2, queries: 1 })
  })

  it('keeps a stable snapshot when the source population is compacted in place', () => {
    const first = { id: 1, x: 0, z: 0, alive: false }
    const second = { id: 2, x: 4, z: 0, alive: true }
    const population = [first, second]
    const index = new EnemySpatialIndex(population, 1)

    population[0] = population[1]
    population.length = 1

    expect(() => index.nearest({ x: 4, z: 0 }, 1, (entity) => entity.alive)).not.toThrow()
    expect(index.nearest({ x: 4, z: 0 }, 1, (entity) => entity.alive)).toBe(second)
    expect(index.telemetry().entities).toBe(2)
  })

  const entities = seededEntities(240)
  const index = new EnemySpatialIndex(entities, 1.25)

  it('matches brute-force radius queries on deterministic data', () => {
    for (const [x, z, radius] of [[0, 0, 2], [4.2, -3.1, 4.5], [-8, 7, 1.3]] as const) {
      const expected = entities.filter((entity) => Math.hypot(entity.x - x, entity.z - z) <= radius).map((entity) => entity.id)
      expect(index.withinRadius({ x, z }, radius).map((entity) => entity.id)).toEqual(expected)
    }
  })

  it('matches brute-force nearest queries and original-order tie breaking', () => {
    const point = { x: 1.25, z: -0.75 }
    const expected = entities
      .map((entity, order) => ({ entity, order, distance: Math.hypot(entity.x - point.x, entity.z - point.z) }))
      .filter((entry) => entry.distance <= 12)
      .sort((left, right) => left.distance - right.distance || left.order - right.order)[0]?.entity
    expect(index.nearest(point, 12)).toBe(expected)
    const tied = [{ id: 1, x: -1, z: 0, alive: true }, { id: 2, x: 1, z: 0, alive: true }]
    expect(new EnemySpatialIndex(tied).nearest({ x: 0, z: 0 }, 2)?.id).toBe(1)
  })

  it('matches brute-force neighbors and supports live predicates', () => {
    const subject = entities[75]
    const expected = entities.filter((entity) => entity !== subject && entity.alive && Math.hypot(entity.x - subject.x, entity.z - subject.z) <= 3).map((entity) => entity.id)
    expect(index.neighbors(subject, 3, (entity) => entity.alive).map((entity) => entity.id)).toEqual(expected)
    expect(index.someWithinRadius(subject, 3, (entity) => entity !== subject && entity.alive)).toBe(expected.length > 0)
  })

  it('handles empty indexes and points outside supplied bounds', () => {
    expect(new EnemySpatialIndex<Entity>([]).nearest({ x: 0, z: 0 }, 4)).toBeUndefined()
    const bounded = new EnemySpatialIndex(entities, 1, { minX: -5, maxX: 5, minZ: -5, maxZ: 5 })
    const outsideExpected = entities.filter((entity) => Math.hypot(entity.x - 30, entity.z - 30) <= 2).map((entity) => entity.id)
    expect(bounded.withinRadius({ x: 30, z: 30 }, 2).map((entity) => entity.id)).toEqual(outsideExpected)
  })

  it('reports query and candidate counts for runtime telemetry', () => {
    const measured = new EnemySpatialIndex(entities, 1.5)
    measured.nearest({ x: 0, z: 0 }, 3)
    measured.withinRadius({ x: 2, z: 2 }, 1)
    expect(measured.telemetry()).toMatchObject({ entities: entities.length, queries: 2 })
    expect(measured.telemetry().candidatesChecked).toBeGreaterThan(0)
  })

  it('can cap local-neighbor work for dense crowd steering', () => {
    const dense = Array.from({ length: 100 }, (_, id) => ({ id, x: 0, z: 0, alive: true }))
    const denseIndex = new EnemySpatialIndex(dense)
    expect(denseIndex.neighbors(dense[0], 1, (entity) => entity.alive, 8)).toHaveLength(8)
    expect(denseIndex.telemetry().candidatesChecked).toBeLessThan(20)
  })
})

function seededEntities(count: number): Entity[] {
  let seed = 0x12345678
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
  }
  return Array.from({ length: count }, (_, id) => ({ id, x: random() * 24 - 12, z: random() * 18 - 9, alive: id % 7 !== 0 }))
}
