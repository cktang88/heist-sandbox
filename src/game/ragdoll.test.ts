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

  it('a body blown down at full speed on slow frames lands on a one-tile slab instead of passing through it', () => {
    const grid = createGrid(20, 24)
    fillTiles(grid, 0, 12, 19, 12, 'concrete')
    fillTiles(grid, 0, 22, 19, 23, 'concrete')
    const ragdoll = createRagdoll({ x: 10, y: 11 }, { x: 0, y: 0 }, createRng(1))
    for (const point of ragdoll.points) point.vy = 40
    for (let frame = 0; frame < 60; frame += 1) stepRagdoll(grid, ragdoll, 1 / 30)
    for (const point of ragdoll.points) expect(point.y).toBeLessThan(12)
  })

  it('a body that starts partly inside a slab (killed on the stairs) steps out of it', () => {
    const grid = createGrid(20, 24)
    fillTiles(grid, 0, 12, 19, 12, 'concrete')
    fillTiles(grid, 0, 22, 19, 23, 'concrete')
    const ragdoll = createRagdoll({ x: 10, y: 13.6 }, { x: 0, y: 0 }, createRng(1))
    for (let frame = 0; frame < 120; frame += 1) stepRagdoll(grid, ragdoll, 1 / 60)
    for (const point of ragdoll.points) expect(isSolidAt(grid, point.x, point.y)).toBe(false)
  })

  it('a body thrown sideways at full speed stops at a one-tile wall', () => {
    const grid = createGrid(30, 12)
    fillTiles(grid, 0, 10, 29, 11, 'concrete')
    fillTiles(grid, 15, 0, 15, 9, 'brick')
    const ragdoll = createRagdoll({ x: 13.5, y: 10 }, { x: 0, y: 0 }, createRng(1))
    for (const point of ragdoll.points) point.vx = 40
    for (let frame = 0; frame < 60; frame += 1) stepRagdoll(grid, ragdoll, 1 / 30)
    for (const point of ragdoll.points) expect(point.x).toBeLessThan(15)
  })
})
