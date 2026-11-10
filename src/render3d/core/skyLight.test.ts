import { describe, expect, it } from 'vitest'
import { createGrid, fillTiles, setTile } from '../../game/tiles'
import { createSkyMap, skyVisibility, updateSkyMap } from './skyLight'

/** A 40 x 30 field with a closed concrete room whose inside spans x 15..24, y 15..19. */
function roomGrid() {
  const grid = createGrid(40, 30)
  fillTiles(grid, 0, 25, 39, 29, 'dirt')
  fillTiles(grid, 14, 14, 25, 20, 'concrete')
  fillTiles(grid, 15, 15, 24, 19, 'air')
  return grid
}

describe('sky visibility', () => {
  it('sees all of the sky in the open and none inside a closed room', () => {
    const grid = roomGrid()
    expect(skyVisibility(grid, 3, 5)).toBeCloseTo(1)
    expect(skyVisibility(grid, 20, 17)).toBe(0)
  })

  it('lets some sky in through a window and more through a hole in the roof', () => {
    const grid = roomGrid()
    setTile(grid, 25, 16, 'glass')
    setTile(grid, 25, 17, 'glass')
    const windowed = skyVisibility(grid, 24, 17)
    expect(windowed).toBeGreaterThan(0)
    fillTiles(grid, 19, 14, 21, 14, 'air')
    expect(skyVisibility(grid, 20, 17)).toBeGreaterThan(windowed)
  })

  it('gives wall tiles the light of the open air beside them, and updates after damage', () => {
    const grid = roomGrid()
    const map = createSkyMap(grid)
    expect(map.values[17 * 40 + 25]).toBeGreaterThan(100)
    expect(map.values[17 * 40 + 20]).toBe(0)
    fillTiles(grid, 14, 14, 25, 14, 'air')
    updateSkyMap(map, grid, 0, 0, 39, 29)
    expect(map.values[17 * 40 + 20]).toBeGreaterThan(60)
  })
})
