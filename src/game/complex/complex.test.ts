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

  it.each(seeds)('seed %i mans every security room with an operator and gives every guard a role, a room and, for patrols, a route on his floor', (seed) => {
    const level = createComplex(seed)
    const roomOf = (id: number | undefined) => level.rooms.find((room) => room.id === id)
    for (const room of level.rooms.filter((candidate) => candidate.kind === 'security')) {
      expect(level.guards.some((guard) => guard.role === 'operator' && guard.roomId === room.id), `operator in room ${room.id}`).toBe(true)
    }
    const vault = level.rooms.find((room) => room.kind === 'vault')!
    const inVault = (x: number, y: number) => y === vault.floorY && x >= vault.x - 1 && x <= vault.x + vault.w
    expect(level.guards.filter((guard) => guard.roomId === vault.id).map((guard) => guard.role)).toEqual(['heavy'])
    expect(level.guards.filter((guard) => guard.role === 'patrol' && guard.route!.some((point) => inVault(point.x, point.y)))).toEqual([])
    const landings = level.stairwells.flatMap((well) => well.stops.flatMap((y) => [{ x: well.leftX, y }, { x: well.rightX, y }]))
    for (const guard of level.guards) {
      const where = `${guard.role} at ${guard.x},${guard.y}`
      expect(guard.role, where).toBeDefined()
      // Sentries stand on watchtower decks, which are not rooms.
      const room = roomOf(guard.roomId)
      if (guard.role !== 'sentry') expect(room, where).toBeDefined()
      if (room) expect(guard.x >= room.x - 1 && guard.x <= room.x + room.w, where).toBe(true)
      expect(landings.some((landing) => landing.y === guard.y && Math.abs(landing.x - (guard.x + 0.5)) < 1.5), `${where} on a stair landing`).toBe(false)
      if (guard.role !== 'patrol') continue
      expect(guard.route?.length, where).toBeGreaterThanOrEqual(2)
      for (const point of guard.route!) {
        expect(point.y, where).toBe(guard.y)
        expect(isSolidAt(level.grid, point.x + 0.5, point.y), `${where} route point ${point.x}`).toBe(true)
        expect(isSolidAt(level.grid, point.x + 0.5, point.y - 1), `${where} route point ${point.x}`).toBe(false)
      }
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
