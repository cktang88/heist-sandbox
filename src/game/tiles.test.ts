import { describe, expect, it } from 'vitest'
import { changeMark, changesFrom, CHUNK_TILES, chunkIndex, createGrid, damageTile, forgetSeenChanges, isSolidAt, setTile, tileAt } from './tiles'

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

  it('lists tiles whose kind changed, for each reader from its own mark, until a whole step has passed', () => {
    const grid = createGrid(4, 4)
    const reader = changeMark(grid)
    setTile(grid, 1, 1, 'brick')
    setTile(grid, 1, 1, 'brick')
    damageTile(grid, 1, 1, 10)
    setTile(grid, 2, 1, 'brick')
    const listed = (mark: number) => grid.changes.tiles.slice(changesFrom(grid, mark))
    expect(listed(reader)).toEqual([5, 6])
    const late = changeMark(grid)
    forgetSeenChanges(grid)
    setTile(grid, 3, 3, 'wood')
    expect(listed(late)).toEqual([15])
    // Kept through the first end of step, so a system that ran before the change still sees it on the next step.
    expect(listed(reader)).toEqual([5, 6, 15])
    forgetSeenChanges(grid)
    expect(changesFrom(grid, reader)).toBe(-1)
    expect(listed(late)).toEqual([15])
  })
})
