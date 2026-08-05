import { describe, expect, it } from 'vitest'
import { addKnockback, stepKnockback } from './knockback'
import { buildNavigationField, isNavigationPointWalkable } from './navigation'
import type { NavigationField } from './navigation'
import type { MapDefinition } from './types'

const OPEN_FIELD: MapDefinition = {
  id: 'force-test', name: 'Force Test', width: 8, depth: 6, pathWidth: 1,
  navigationMode: 'open', paths: [[{ x: -3.5, z: 0 }, { x: 3.5, z: 0 }]],
}

describe('collision-safe knockback', () => {
  it('moves a body through open ground and decays its impulse', () => {
    const field = buildNavigationField(OPEN_FIELD)
    const body = { x: -1, z: 0, knockbackX: 0, knockbackZ: 0 }
    addKnockback(body, { x: -2, z: 0 }, 2)
    stepKnockback(body, field, 0.1)
    expect(body.x).toBeGreaterThan(-1)
    expect(body.knockbackX).toBeLessThan(2)
  })

  it('cannot tunnel through a temporary wall even with a large impulse', () => {
    const field = buildNavigationField(OPEN_FIELD, [{ id: 1, x: 0, z: 0, rotation: 0, length: 4, radius: 0.45 }])
    const body = { x: -0.8, z: 0, knockbackX: 12, knockbackZ: 0 }
    stepKnockback(body, field, 0.3)
    expect(body.x).toBeLessThan(0)
    expect(isNavigationPointWalkable(field, body)).toBe(true)
    expect(body.knockbackX).toBe(0)
  })

  it('cannot combine two axis slides into a blocked diagonal cell', () => {
    const field: NavigationField = {
      columns: 2, rows: 2, cellSize: 1, originX: 0, originZ: 0,
      walkable: new Uint8Array([1, 1, 1, 0]),
      distances: new Float32Array(4), nextCell: new Int32Array(4), blockingOwner: new Int32Array(4),
      wallIds: [], goals: [],
    }
    const body = { x: 0.9, z: 0.9, knockbackX: 0.2, knockbackZ: 0.2 }

    stepKnockback(body, field, 1)

    expect(isNavigationPointWalkable(field, body)).toBe(true)
    expect(body.x >= 1 && body.z >= 1).toBe(false)
  })
})
