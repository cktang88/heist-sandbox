import { describe, expect, it } from 'vitest'
import { CHUNK_TILES, chunkIndex, createGrid, damageTile, isSolidAt, setTile, tileAt } from './tiles'

describe('tiles', () => {
  it('treats everything outside the map as bedrock', () => {
    const grid = createGrid(4, 4)
    expect(tileAt(grid, -1, 0)).toBe('bedrock')
    expect(isSolidAt(grid, 10, 10)).toBe(true)
  })

  it('destroys a tile once its health runs out', () => {
    const grid = createGrid(4, 4)
    setTile(grid, 1, 1, 'brick')
    expect(damageTile(grid, 1, 1, 40)).toBeNull()
    expect(damageTile(grid, 1, 1, 40)).toBe('brick')
    expect(tileAt(grid, 1, 1)).toBe('air')
  })

  it('never destroys bedrock', () => {
    const grid = createGrid(4, 4)
    setTile(grid, 2, 2, 'bedrock')
    expect(damageTile(grid, 2, 2, 1e9)).toBeNull()
    expect(tileAt(grid, 2, 2)).toBe('bedrock')
  })

  it('flags the chunk of a changed tile, and the neighbouring chunk only when the tile is on their shared edge', () => {
    const grid = createGrid(CHUNK_TILES * 3, CHUNK_TILES * 3)
    setTile(grid, CHUNK_TILES + 5, CHUNK_TILES + 5, 'brick')
    expect([...grid.dirtyChunks]).toEqual([chunkIndex(grid, 1, 1)])
    grid.dirtyChunks.clear()
    setTile(grid, CHUNK_TILES, CHUNK_TILES * 2 - 1, 'brick')
    expect([...grid.dirtyChunks].sort((a, b) => a - b)).toEqual([chunkIndex(grid, 1, 1), chunkIndex(grid, 0, 1), chunkIndex(grid, 1, 2)].sort((a, b) => a - b))
    grid.dirtyChunks.clear()
    setTile(grid, 0, 0, 'brick')
    expect([...grid.dirtyChunks]).toEqual([chunkIndex(grid, 0, 0)])
  })
})
