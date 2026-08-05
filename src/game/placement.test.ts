import { describe, expect, it } from 'vitest'
import { isValidPlacement } from './placement'
import { BROKEN_CITADEL, FROZEN_PASS, GREEN_MARCH, SHATTERED_EXPANSE } from './maps'

describe('build placement', () => {
  it('places every tower off the route and walls on it', () => {
    const grass = { x: 0, z: -5 }
    const road = { x: 0, z: 2.7 }
    expect(isValidPlacement(grass, 'heavyGun', [], GREEN_MARCH)).toBe(true)
    expect(isValidPlacement(road, 'heavyGun', [], GREEN_MARCH)).toBe(false)
    expect(isValidPlacement(road, 'wall', [], GREEN_MARCH)).toBe(true)
  })

  it('rejects tower placement on a saved boulder', () => {
    const map = { ...GREEN_MARCH, obstacles: [{ x: 0, z: -5, radius: 0.7 }] }
    expect(isValidPlacement({ x: 0, z: -5 }, 'gunner', [], map)).toBe(false)
  })

  it('keeps walls clear of spawn and fortress protection zones', () => {
    const spawn = GREEN_MARCH.paths[0][0]
    const fortress = GREEN_MARCH.paths[0].at(-1)!
    expect(isValidPlacement(spawn, 'wall', [], GREEN_MARCH)).toBe(false)
    expect(isValidPlacement(fortress, 'wall', [], GREEN_MARCH)).toBe(false)
  })

  it('keeps towers inside authored build zones without restricting combat walls', () => {
    const map = { ...GREEN_MARCH, buildZones: [{ x: 0, z: -5, radius: 1.2 }] }
    expect(isValidPlacement({ x: 0, z: -5 }, 'gunner', [], map)).toBe(true)
    expect(isValidPlacement({ x: -9, z: 5 }, 'gunner', [], map)).toBe(false)
    expect(isValidPlacement({ x: -8, z: -2.8 }, 'wall', [], map)).toBe(true)
  })

  it.each([FROZEN_PASS, BROKEN_CITADEL])('keeps every authored zone usable on $name', (map) => {
    for (const zone of map.buildZones ?? []) {
      const candidates = [-1, -0.5, 0, 0.5, 1].flatMap((dx) => [-1, -0.5, 0, 0.5, 1]
        .map((dz) => ({ x: zone.x + dx, z: zone.z + dz }))
        .filter((point) => Math.hypot(point.x - zone.x, point.z - zone.z) <= zone.radius))
      expect(candidates.some((point) => isValidPlacement(point, 'gunner', [], map))).toBe(true)
    }
  })

  it('accepts towers on open-field platforms but not on the surrounding horde field', () => {
    const platform = SHATTERED_EXPANSE.solidPolygons![0]
    const center = { x: platform.points.reduce((sum, point) => sum + point.x, 0) / platform.points.length, z: platform.points.reduce((sum, point) => sum + point.z, 0) / platform.points.length }
    expect(isValidPlacement(center, 'gunner', [], SHATTERED_EXPANSE)).toBe(true)
    expect(isValidPlacement({ x: 1.5, z: 0 }, 'gunner', [], SHATTERED_EXPANSE)).toBe(false)
    expect(isValidPlacement({ x: 1.5, z: 0 }, 'wall', [], SHATTERED_EXPANSE)).toBe(true)
  })
})
