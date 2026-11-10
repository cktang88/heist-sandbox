import { describe, expect, it } from 'vitest'
import { BONES, createRagdoll, stepRagdoll } from './ragdoll'
import { createRng } from './rng'
import { createGrid, fillTiles, isSolidAt } from './tiles'

describe('ragdoll', () => {
  it('flops to the floor without stretching or sinking into it', () => {
    const grid = createGrid(20, 12)
    fillTiles(grid, 0, 10, 19, 11, 'concrete')
    const ragdoll = createRagdoll({ x: 10, y: 6 }, { x: 6, y: -8 }, createRng(1))
    const lengths = () => BONES.map(([a, b]) => Math.hypot(ragdoll.points[a].x - ragdoll.points[b].x, ragdoll.points[a].y - ragdoll.points[b].y))
    const rest = lengths()
    for (let frame = 0; frame < 240; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
    for (const point of ragdoll.points) {
      expect(isSolidAt(grid, point.x, point.y)).toBe(false)
      expect(point.y).toBeGreaterThan(8.5)
    }
    lengths().forEach((length, index) => expect(Math.abs(length - rest[index])).toBeLessThan(0.12))
  })
})
