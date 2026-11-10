import { describe, expect, it } from 'vitest'
import { canWalkAcross } from '../gaps/gaps'
import { fillTiles, setTile } from '../tiles'
import { enterCombat } from './combat'
import { flankRoute } from './flank'
import { addGuard, addRoom, addUpperFloor, arena, GROUND } from './testArena'
import { isDoorway } from './places'
import { findShelter } from './shelter'

/** Openings the player blew are new routes and new firing lines for the guards too. */

describe('openings the player made', () => {
  it('a hole blown in a thick wall, with wall left above it, is a frame nobody stands in', () => {
    const world = arena()
    // A facade two tiles thick (x 50-51), blown through at body height with the top rows still standing.
    fillTiles(world.grid, 50, GROUND - 6, 51, GROUND - 1, 'concrete')
    fillTiles(world.grid, 50, GROUND - 3, 51, GROUND - 1, 'air')
    expect(isDoorway(world, 50, GROUND)).toBe(true)
    expect(isDoorway(world, 51, GROUND)).toBe(true)
    expect(isDoorway(world, 45, GROUND)).toBe(false)
    // Rounds coming in from beyond: the shelter he picks is never in the opening.
    const guard = addGuard(world, 50.5, 1)
    const shelter = findShelter(world, guard, { x: 70, y: GROUND - 1 }, 6, false)
    expect(Math.floor(shelter.x) === 50 || Math.floor(shelter.x) === 51).toBe(false)
  })

  it('a flanker on the storey above comes down on the man through a hole blown in the floor beyond him', () => {
    const world = arena()
    const upper = addUpperFloor(world, 0, 120)
    addRoom(world, { kind: 'office', building: 'site', x: 0, w: 120, floorY: upper })
    // The only staircase comes out on the squad's side of him.
    world.stairwells.push({ id: 0, building: 'site', leftX: 20, rightX: 24, stops: [GROUND, upper] })
    canWalkAcross(world, 70, upper)
    setTile(world.grid, 70, upper, 'air')
    const squad = [40, 42].map((x) => addGuard(world, x, 1))
    for (const guard of squad) enterCombat(world, guard, { x: 60, y: GROUND - 1 })
    const flanker = addGuard(world, 50, 1, 'patrol', upper)
    enterCombat(world, flanker, { x: 60, y: GROUND - 1 })
    const route = flankRoute(world, flanker, { x: 60, y: GROUND })
    expect(route).not.toBeNull()
    expect(route!.some((point) => Math.abs(point.x - 70.5) < 0.6 && Math.abs(point.y - upper) < 0.5)).toBe(true)
  })
})
