import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { smokeBetween, smokeDensityAt } from './hazards'
import { addSmoke } from './smoke'
import { bareWorld, box, run } from './testWorld'

/** Average smoke density along one row, from column x0 to x1. */
function rowDensity(world: ReturnType<typeof bareWorld>, y: number, x0: number, x1: number): number {
  let sum = 0
  for (let x = x0; x <= x1; x += 1) sum += smokeDensityAt(world, { x: x + 0.5, y: y + 0.5 })
  return sum / (x1 - x0 + 1)
}

describe('smoke', () => {
  it('rises and fills the top of a closed room before the bottom, blocking sight up there', () => {
    const world = bareWorld(30, 20)
    box(world, 5, 5, 14, 9)
    run(world, 4, () => addSmoke(world, 10, 9, 4 / 60, 'toxic'))
    const top = rowDensity(world, 5, 5, 14)
    const bottom = rowDensity(world, 9, 5, 14)
    expect(top).toBeGreaterThan(0.3)
    expect(top).toBeGreaterThan(bottom * 1.5)
    expect(smokeBetween(world, { x: 5.5, y: 5.5 }, { x: 14.5, y: 5.5 })).toBeGreaterThan(0.6)
    expect(smokeBetween(world, { x: 5.5, y: 2.5 }, { x: 14.5, y: 2.5 })).toBe(0)
  })

  it('leaks through an open doorway but not through a wall', () => {
    const leak = (doorway: boolean) => {
      const world = bareWorld(40, 20)
      box(world, 5, 5, 25, 9)
      fillTiles(world.grid, 15, 5, 15, 9, 'concrete')
      if (doorway) fillTiles(world.grid, 15, 7, 15, 9, 'air')
      run(world, 8, () => addSmoke(world, 8, 9, 3 / 60, 'screen'))
      return rowDensity(world, 8, 16, 19)
    }
    expect(leak(true)).toBeGreaterThan(0.05)
    expect(leak(false)).toBe(0)
  })

  it('thins away once nothing feeds it', () => {
    const world = bareWorld(30, 20)
    box(world, 5, 5, 14, 9)
    addSmoke(world, 10, 9, 3, 'screen')
    run(world, 2)
    expect(world.hazards.smoke!.active.length).toBeGreaterThan(10)
    run(world, 60)
    expect(world.hazards.smoke!.active.length).toBe(0)
  })

  it('is clear when there is no smoke at all', () => {
    const world = bareWorld()
    expect(smokeBetween(world, { x: 2, y: 2 }, { x: 40, y: 10 })).toBe(0)
  })
})
