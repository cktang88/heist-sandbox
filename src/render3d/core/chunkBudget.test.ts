import { describe, expect, it } from 'vitest'
import { chunkIndex, createGrid } from '../../game/tiles'
import { holdBackFarChunks } from './chunkBudget'

describe('chunk re-meshing budget', () => {
  it('leaves only the chunks nearest the view and hands back the rest', () => {
    const grid = createGrid(160, 64)
    for (let x = 0; x < 10; x += 1) grid.dirtyChunks.add(chunkIndex(grid, x, 0))
    const held = holdBackFarChunks(grid, { x: 8, y: 8 }, 3)
    expect([...grid.dirtyChunks].sort((a, b) => a - b)).toEqual([0, 1, 2])
    expect(held).toHaveLength(7)
  })

  it('holds nothing back when few chunks are dirty', () => {
    const grid = createGrid(160, 64)
    grid.dirtyChunks.add(5)
    expect(holdBackFarChunks(grid, { x: 0, y: 0 }, 3)).toEqual([])
    expect(grid.dirtyChunks.size).toBe(1)
  })
})
