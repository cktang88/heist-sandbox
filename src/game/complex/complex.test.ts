import { describe, expect, it } from 'vitest'
import { findUnsupported } from '../collapse'
import { isSolidAt, tileAt } from '../tiles'
import { COMPLEX_GROUND, createComplex } from './complex'
import { STOREY } from './kit'

describe('createComplex', () => {
  const seeds = [1, 2, 3, 7, 42]

  it.each(seeds)('seed %i stands up without anything hanging in mid-air', (seed) => {
    expect(findUnsupported(createComplex(seed).grid)).toEqual([])
  })

  it.each(seeds)('seed %i puts every guard and the loot on solid footing with headroom', (seed) => {
    const level = createComplex(seed)
    for (const spot of [...level.guards, level.loot]) {
      expect(isSolidAt(level.grid, spot.x, spot.y), `footing at ${spot.x},${spot.y}`).toBe(true)
      expect(isSolidAt(level.grid, spot.x, spot.y - 1), `headroom at ${spot.x},${spot.y}`).toBe(false)
      expect(isSolidAt(level.grid, spot.x, spot.y - 2)).toBe(false)
    }
  })

  it.each(seeds)('seed %i has a tower of at least twenty storeys with stairs to every floor', (seed) => {
    const level = createComplex(seed)
    const tower = level.rooms.filter((room) => room.building === 'tower')
    const top = Math.max(...tower.map((room) => room.storey))
    expect(top).toBeGreaterThanOrEqual(20)
    const mainStairs = level.stairwells.find((well) => well.building === 'tower')!
    expect(mainStairs.stops.length).toBeGreaterThanOrEqual(top + 3)
    for (const stop of mainStairs.stops) {
      for (const x of [mainStairs.leftX, mainStairs.rightX]) {
        expect(isSolidAt(level.grid, x, stop), `landing floor at ${x},${stop}`).toBe(true)
        expect(isSolidAt(level.grid, x, stop - 1)).toBe(false)
      }
    }
  })

  it.each(seeds)('seed %i has rooms that do not overlap and sit on real floors', (seed) => {
    const level = createComplex(seed)
    const indoor = level.rooms.filter((room) => !['street', 'yard', 'rooftop', 'sewer', 'silo'].includes(room.kind))
    for (const room of indoor) {
      expect(room.w).toBeGreaterThanOrEqual(6)
      const middle = room.x + Math.floor(room.w / 2)
      expect(isSolidAt(level.grid, middle, room.floorY), `floor of room ${room.id} ${room.kind}`).toBe(true)
      expect(isSolidAt(level.grid, middle, room.floorY - 1), `open space in room ${room.id} ${room.kind}`).toBe(false)
    }
    for (const a of indoor) {
      for (const b of indoor) {
        if (a.id >= b.id || a.building !== b.building) continue
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap, `rooms ${a.id} and ${b.id}`).toBe(false)
      }
    }
  })

  it('has a varied site: many room kinds, wide and narrow rooms, a vault, fences and silos', () => {
    const level = createComplex(1)
    const kinds = new Set(level.rooms.map((room) => room.kind))
    expect(kinds.size).toBeGreaterThanOrEqual(18)
    const widths = level.rooms.filter((room) => room.building === 'tower').map((room) => room.w)
    expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThanOrEqual(10)
    expect(level.rooms.some((room) => room.h > STOREY)).toBe(true)
    expect(level.rooms.filter((room) => room.kind === 'vault').length).toBe(1)
    expect(tileAt(level.grid, 34, COMPLEX_GROUND - 5)).toBe('fence')
    expect(level.elevators.length).toBe(2)
    expect(level.guards.length).toBeGreaterThan(40)
  })

  it('is the same for the same seed', () => {
    expect(createComplex(9).grid.kinds).toEqual(createComplex(9).grid.kinds)
  })
})
