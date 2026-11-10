import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { floorBelow } from './places'
import { addRoom, arena, GROUND } from './testArena'

describe('where things are', () => {
  it('rubble heaped on a room floor is still that floor, not a storey of its own', () => {
    const world = arena()
    addRoom(world, { kind: 'office', building: 'b', x: 10, w: 40, floorY: GROUND })
    fillTiles(world.grid, 20, GROUND - 2, 24, GROUND - 1, 'concrete')
    expect(floorBelow(world, { x: 22.5, y: GROUND - 4 })).toEqual({ x: 22.5, y: GROUND })
    expect(floorBelow(world, { x: 30.5, y: GROUND - 4 })).toEqual({ x: 30.5, y: GROUND })
  })
})
