import { describe, expect, it } from 'vitest'
import { createGrid, damageTile, isSolidAt, setTile, tileAt } from './tiles'

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
})
