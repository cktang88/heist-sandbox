import { describe, expect, it } from 'vitest'
import { createLevel, GROUND } from './level'
import { mirrorLevel } from './mirror'
import { isSolidAt, tileAt } from './tiles'

describe('createLevel', () => {
  it.each([1, 2, 3, 42])('seed %i puts every guard and the loot on solid footing', (seed) => {
    const level = createLevel(seed)
    for (const spot of [...level.guards, level.loot]) {
      expect(isSolidAt(level.grid, spot.x, spot.y)).toBe(true)
      expect(isSolidAt(level.grid, spot.x, spot.y - 1)).toBe(false)
      expect(isSolidAt(level.grid, spot.x, spot.y - 2)).toBe(false)
    }
  })

  it('offers a front door, a manhole and a sewer hatch', () => {
    const { grid } = createLevel(1)
    expect(tileAt(grid, 70, GROUND - 1)).toBe('door')
    expect(tileAt(grid, 20, GROUND)).toBe('ladder')
    expect(tileAt(grid, 88, 48)).toBe('door')
  })

  it('keeps everything on solid footing when mirrored', () => {
    const level = mirrorLevel(createLevel(5))
    for (const spot of [...level.guards, level.loot, ...level.pickups]) {
      expect(isSolidAt(level.grid, spot.x, spot.y)).toBe(true)
      expect(isSolidAt(level.grid, spot.x, spot.y - 1)).toBe(false)
    }
    expect(tileAt(level.grid, 149 - 70, GROUND - 1)).toBe('door')
    expect(level.extraction.x).toBeGreaterThan(130)
  })

  it('is the same for the same seed', () => {
    expect(createLevel(7).grid.kinds).toEqual(createLevel(7).grid.kinds)
  })
})
