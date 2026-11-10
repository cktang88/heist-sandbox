import { describe, expect, it } from 'vitest'
import { raiseLevel } from './report'
import { assignStations } from './stations'
import { addGuard, addUpperFloor, arena, GROUND } from './testArena'

describe('stations on alert', () => {
  it('reassigning the stations takes back only those the control room gave, never an errand from elsewhere', () => {
    const world = arena()
    const upper = addUpperFloor(world, 0, 120)
    world.stairwells.push({ id: 0, building: 'site', leftX: 5, rightX: 9, stops: [GROUND, upper] })
    const errand = addGuard(world, 60, 1, 'patrol')
    const spare = addGuard(world, 30, 1, 'patrol')
    const own = { x: 61, y: GROUND }
    errand.station = own
    world.security.focus = { x: 20, y: GROUND }
    raiseLevel(world, 2)
    expect(world.security.level).toBe(2)
    assignStations(world)
    assignStations(world)
    expect(errand.station).toBe(own)
    expect(spare.station).not.toBeNull()
  })
})
