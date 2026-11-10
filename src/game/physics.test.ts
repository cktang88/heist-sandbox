import { describe, expect, it } from 'vitest'
import { canStepUpAhead, GRAVITY, moveBody } from './physics'
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

  /** Runs a body at a wall `height` tiles high, standing on the ground, with up to `stepUp` tiles of climb. */
  function runAt(height: number, stepUp?: number): Body {
    const grid = createGrid(12, 12)
    fillTiles(grid, 0, 10, 11, 11, 'concrete')
    fillTiles(grid, 6, 10 - height, 11, 9, 'dirt')
    const target = body(4, 8.3)
    fall(grid, target, 0.3)
    for (let index = 0; index < 40; index += 1) {
      target.vx = 8
      target.vy += GRAVITY / 60
      moveBody(grid, target, 1 / 60, stepUp)
    }
    return target
  }

  it('lets a person climb a waist-high (one tile) ledge without jumping, but not one two tiles high', () => {
    expect(runAt(1).x).toBeGreaterThan(6)
    expect(runAt(2).x + 0.7).toBeLessThanOrEqual(6)
  })

  it('does not let things that are not people climb at all', () => {
    expect(runAt(1, 0).x + 0.7).toBeLessThanOrEqual(6)
  })

  it('tells route planning the same: a one-tile step ahead is climbed, a two-tile one is not', () => {
    for (const [height, climbs] of [[1, true], [2, false]] as const) {
      const grid = createGrid(12, 12)
      fillTiles(grid, 0, 10, 11, 11, 'concrete')
      fillTiles(grid, 6, 10 - height, 11, 9, 'dirt')
      const target = body(6 - 0.7 - 0.01, 10 - 1.6 - 0.01)
      expect(canStepUpAhead(grid, target, 1)).toBe(climbs)
    }
  })
})
