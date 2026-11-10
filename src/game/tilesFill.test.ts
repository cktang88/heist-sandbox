import { describe, expect, it } from 'vitest'
import { createGrid, fillTiles, setTile, type Grid, type TileKind } from './tiles'

function fillOneByOne(grid: Grid, x0: number, y0: number, x1: number, y1: number, kind: TileKind): void {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) setTile(grid, x, y, kind)
}

describe('fillTiles', () => {
  // Rectangles on chunk edges, inside one chunk, past the grid's edges, and empty ones.
  const cases: [number, number, number, number][] = [
    [0, 0, 0, 0], [15, 15, 16, 16], [16, 16, 31, 31], [3, 4, 9, 7], [-5, -3, 20, 2], [40, 30, 60, 50], [10, 10, 5, 12], [47, 0, 47, 35],
  ]
  for (const [x0, y0, x1, y1] of cases) {
    it(`matches setting each tile of ${x0},${y0}..${x1},${y1}`, () => {
      const fast = createGrid(48, 36)
      const slow = createGrid(48, 36)
      fillTiles(fast, x0, y0, x1, y1, 'brick')
      fillOneByOne(slow, x0, y0, x1, y1, 'brick')
      expect(fast.kinds).toEqual(slow.kinds)
      expect(fast.hp).toEqual(slow.hp)
      expect(fast.version).toBe(slow.version)
      expect([...fast.dirtyChunks].sort()).toEqual([...slow.dirtyChunks].sort())
    })
  }
})
