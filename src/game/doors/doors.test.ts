import { describe, expect, it } from 'vitest'
import { keypadFor } from '../devices/locks'
import { addDevice, addGuard, arena, GROUND, putPlayer, run } from '../security/testArena'
import { fillTiles, tileAt } from '../tiles'
import type { World } from '../world'
import { openedDoors } from './doors'
import { doorColumn } from '../elevators'
import { createWorld } from '../world'

/**
 * Doors the player opens by hand can be shut again, and a shut door shows nothing. A patrol that finds one standing
 * open shuts it and shrugs; only a door kicked in, pried or blown out is a forced lock.
 */

/** A shut, locked door at x 50, floor to ceiling, so nothing above it falls in when it opens. */
function doorAt50(world: World): void {
  fillTiles(world.grid, 50, GROUND - 5, 50, GROUND - 1, 'door')
}

/** The player crouched against the left of the door picks its lock. */
function pickIt(world: World): void {
  putPlayer(world, 49.2)
  world.player.facing = 1
  run(world, 0.1, { crouch: true })
  expect(world.prompt).toBe('Hold E: pick lock')
  run(world, 1.6, { crouch: true, interact: true })
  expect(tileAt(world.grid, 50, GROUND - 1)).toBe('air')
}

/** A patrol walking through the doorway and back, a few seconds behind the player. */
function patrolThrough(world: World): void {
  const patrol = addGuard(world, 60, -1, 'patrol')
  patrol.route = [{ x: 60.5, y: GROUND }, { x: 40.5, y: GROUND }]
}

describe('doors by hand', () => {
  it('a picked door can be eased shut again, crouched, with E', () => {
    const world = arena()
    doorAt50(world)
    pickIt(world)
    run(world, 0.1, { crouch: true })
    expect(world.prompt).toBe('E: ease the door shut (silent)')
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    expect(tileAt(world.grid, 50, GROUND - 1)).toBe('door')
    expect(openedDoors(world).size).toBe(0)
  })

  it('a picked lock shut again leaves no trace for the patrol that walks through later', () => {
    const world = arena()
    doorAt50(world)
    pickIt(world)
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    putPlayer(world, 140)
    patrolThrough(world)
    run(world, 40)
    expect(world.security.level).toBe(0)
    expect(world.security.log.some((line) => line.includes('forced lock'))).toBe(false)
  })

  it('a picked door left standing open is shut by the guard who finds it, who looks round and does not call a forced lock', () => {
    const world = arena()
    doorAt50(world)
    pickIt(world)
    putPlayer(world, 140)
    const guard = addGuard(world, 44, 1)
    run(world, 15)
    expect(tileAt(world.grid, 50, GROUND - 1)).toBe('door')
    expect(world.security.level).toBeLessThanOrEqual(1)
    expect(world.security.log.some((line) => line.includes('forced lock'))).toBe(false)
    run(world, 10)
    expect(guard.mode === 'calm' || guard.mode === 'caution').toBe(true)
  })

  it('a door kicked in is a forced lock (site level 2)', () => {
    const world = arena()
    doorAt50(world)
    putPlayer(world, 49.2)
    world.player.facing = 1
    run(world, 0.1)
    run(world, 1 / 60, { kickPressed: true })
    run(world, 0.5)
    expect(tileAt(world.grid, 50, GROUND - 1)).toBe('air')
    putPlayer(world, 140)
    addGuard(world, 44, 1)
    run(world, 20)
    expect(world.security.log.some((line) => line.includes('forced lock'))).toBe(true)
    expect(world.security.level).toBe(2)
  })

  it('a keypad door opened with a stolen keycard locks again when shut', () => {
    const world = arena()
    doorAt50(world)
    addDevice(world, { kind: 'keypad', x: 48, y: GROUND - 2, target: { x: 50, y: GROUND - 1 } })
    world.stealth.keycards.add(0)
    putPlayer(world, 49.2)
    world.player.facing = 1
    run(world, 0.1, { crouch: true })
    expect(world.prompt).toBe('E: swipe the keycard')
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    expect(tileAt(world.grid, 50, GROUND - 1)).toBe('air')
    run(world, 0.1, { crouch: true })
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    expect(tileAt(world.grid, 50, GROUND - 1)).toBe('door')
    expect(keypadFor(world, { x: 50, y: GROUND - 1 })?.hacked).toBe(false)
  })

  it('standing up, the prompt offers to close the door (with a clunk)', () => {
    const world = arena()
    doorAt50(world)
    pickIt(world)
    run(world, 0.1)
    expect(world.prompt).toBe('E: close door')
  })

  it('an elevator called to a floor, standing with its doors open, is never reported as a forced lock', () => {
    const world = createWorld(1, 'complex')
    world.guards = []
    const shaft = world.elevators[0]
    const car = world.elevatorCars[0]
    const door = doorColumn(shaft)
    putPlayer(world, door + 0.5 + shaft.doorSide * 1.5, world.groundY)
    run(world, 0.1)
    expect(world.prompt).toBe('E: call elevator')
    run(world, 1 / 60, { interact: true, interactPressed: true })
    run(world, 6)
    expect(car.doorsOpen).toBe(true)
    putPlayer(world, 10, world.groundY)
    addGuard(world, door + 0.5 + shaft.doorSide * 5, -shaft.doorSide as 1 | -1, 'post', world.groundY)
    run(world, 20)
    expect(world.security.log.some((line) => line.includes('forced lock'))).toBe(false)
  })
})
