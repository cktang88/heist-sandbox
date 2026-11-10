import { describe, expect, it } from 'vitest'
import { createGrid, fillTiles, setTile, type Grid } from '../game/tiles'
import { isRubbleColor, stepPiece, type Piece } from './rubble3d'

function settle(piece: Piece, grid: Grid, seconds: number): void {
  for (let time = 0; time < seconds; time += 1 / 60) stepPiece(piece, grid, 1 / 60)
}

describe('rubble', () => {
  it('treats bits of wall as rubble but not sparks or blood', () => {
    expect(isRubbleColor('#8d9199')).toBe(true)
    expect(isRubbleColor('#ffb347')).toBe(false)
    expect(isRubbleColor('#b3202a')).toBe(false)
  })

  it('comes to rest lying on the floor, and drops again when the floor under it is blown away', () => {
    const grid = createGrid(20, 20)
    fillTiles(grid, 0, 10, 19, 10, 'concrete')
    fillTiles(grid, 0, 16, 19, 16, 'concrete')
    const piece: Piece = { x: 5.5, y: 6, vx: 3, vy: -4, size: 0.2, resting: false }
    settle(piece, grid, 3)
    expect(piece.resting).toBe(true)
    expect(piece.y).toBeGreaterThan(9.7)
    expect(piece.y).toBeLessThan(10)
    setTile(grid, Math.floor(piece.x), 10, 'air')
    settle(piece, grid, 3)
    expect(piece.resting).toBe(true)
    expect(piece.y).toBeGreaterThan(15.7)
    expect(piece.y).toBeLessThan(16)
  })
})
