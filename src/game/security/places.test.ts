import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { floorBelow, sameFloor, sameStretch } from './places'
import { planSearch } from './search'
import { createWorld } from '../world'
import { addRoom, arena, GROUND } from './testArena'

describe('where things are', () => {
  it('rubble heaped on a room floor is still that floor, not a storey of its own', () => {
    const world = arena()
    addRoom(world, { kind: 'office', building: 'b', x: 10, w: 40, floorY: GROUND })
    fillTiles(world.grid, 20, GROUND - 2, 24, GROUND - 1, 'concrete')
    expect(floorBelow(world, { x: 22.5, y: GROUND - 4 })).toEqual({ x: 22.5, y: GROUND })
    expect(floorBelow(world, { x: 30.5, y: GROUND - 4 })).toEqual({ x: 30.5, y: GROUND })
  })

  it('a spot high over open air (a blast in a shaft, a shot in the sky) is on the ground far below, never in mid-air', () => {
    const world = arena()
    expect(floorBelow(world, { x: 40.5, y: 2.4 })).toEqual({ x: 40.5, y: GROUND })
  })
})

describe('planning a search in the tower', () => {
  it.each([1, 2])('seed %i: the nearest rooms to search are never ones across the elevator core on the same floor', (seed) => {
    const world = createWorld(seed, 'complex')
    const across: string[] = []
    for (const room of world.rooms) {
      if (room.building !== 'tower' || room.kind === 'stairwell') continue
      const center = { x: room.x + room.w / 2, y: room.floorY }
      world.security.searched.clear()
      for (const point of planSearch(world, center).points.slice(1)) {
        if (sameFloor(point, center) && !sameStretch(world, center, point)) across.push(`${center.x},${center.y} to ${point.x}`)
      }
    }
    expect(across).toEqual([])
  })
})
