import { describe, expect, it } from 'vitest'
import { raiseLevel } from './report'
import { assignStations } from './stations'
import { isFree } from './orders'
import { reportEvent } from './report'
import { idleInput } from '../input'
import { stepWorld } from '../step'
import { createWorld } from '../world'
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

  it('a guard on his way to a station keeps it when the stations are reassigned, rather than swapping with whoever is nearer by then', () => {
    const world = createWorld(3, 'complex')
    Object.assign(world.player, { x: world.extraction.x + 1, y: world.groundY - 1.7, vx: 0, vy: 0, chute: false, hp: 1e9 })
    const room = world.rooms.filter((one) => one.building === 'tower' && one.storey === 8)[0]
    reportEvent(world, { kind: 'body', at: { x: room.x + room.w / 2, y: room.floorY - 0.3 }, by: 0 })
    expect(world.security.level).toBe(2)
    const first = new Map([...world.security.stations].filter(([guard, spot]) => guard.station === spot))
    expect(first.size).toBeGreaterThan(0)
    // Long enough for the control room to reassign the stations a few times over.
    for (let frame = 0; frame < 70 * 20; frame += 1) stepWorld(world, idleInput({ x: world.player.x + 5, y: world.player.y }), 1 / 20)
    expect(world.security.level).toBe(2)
    const swapped = [...first].filter(([guard, spot]) => isFree(guard) && world.security.stations.get(guard) !== undefined
      ? world.security.stations.get(guard)!.x !== spot.x || world.security.stations.get(guard)!.y !== spot.y
      : isFree(guard))
    expect(swapped.map(([guard]) => world.guards.indexOf(guard))).toEqual([])
  })
})

