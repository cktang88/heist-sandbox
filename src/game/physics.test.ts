import { describe, expect, it } from 'vitest'
import { GRAVITY, moveBody } from './physics'
import { createGrid, fillTiles, setTile } from './tiles'
import type { Body } from './types'

function body(x: number, y: number): Body {
  return { x, y, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: false }
}

function fall(grid: ReturnType<typeof createGrid>, target: Body, seconds: number): void {
  for (let time = 0; time < seconds; time += 1 / 60) {
    target.vy += GRAVITY / 60
    moveBody(grid, target, 1 / 60)
  }
}

describe('moveBody', () => {
  it('lands on the floor', () => {
    const grid = createGrid(10, 10)
    fillTiles(grid, 0, 8, 9, 9, 'concrete')
    const target = body(4, 2)
    fall(grid, target, 2)
    expect(target.onGround).toBe(true)
    expect(target.y + target.h).toBeCloseTo(8, 1)
  })

  it('is stopped by a wall', () => {
    const grid = createGrid(10, 10)
    fillTiles(grid, 0, 8, 9, 9, 'concrete')
    fillTiles(grid, 6, 0, 6, 7, 'brick')
    const target = body(4, 6.3)
    fall(grid, target, 0.2)
    target.vx = 10
    expect(moveBody(grid, target, 0.5)).toBe(true)
    expect(target.x + target.w).toBeLessThanOrEqual(6)
  })

  it('steps up a one-tile ledge while running', () => {
    const grid = createGrid(10, 10)
    fillTiles(grid, 0, 8, 9, 9, 'concrete')
    setTile(grid, 6, 7, 'dirt')
    const target = body(4, 6.3)
    fall(grid, target, 0.2)
    for (let index = 0; index < 30; index += 1) {
      target.vx = 8
      target.vy += GRAVITY / 60
      moveBody(grid, target, 1 / 60)
    }
    expect(target.x).toBeGreaterThan(6)
  })
})
