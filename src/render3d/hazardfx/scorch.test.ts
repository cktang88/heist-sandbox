import { describe, expect, it } from 'vitest'
import { createGrid, setTile } from '../../game/tiles'
import { plumeSpan } from './scorch'

describe('scorch plume', () => {
  it('climbs the back wall up to the ceiling and no further', () => {
    const grid = createGrid(20, 20)
    for (let x = 0; x < 20; x += 1) setTile(grid, x, 10, 'concrete')
    // A charge just under the ceiling (row 10 is the slab).
    const span = plumeSpan(grid, 5.5, 11.3, 2.5)
    expect(span.top).toBe(11)
    expect(span.bottom).toBeCloseTo(11.8)
  })

  it('keeps its full height in an open room', () => {
    const grid = createGrid(20, 20)
    const span = plumeSpan(grid, 5.5, 15, 2)
    expect(span.top).toBeCloseTo(12.4)
  })
})
