import { describe, expect, it } from 'vitest'
import { circuitOf } from '../complex/kit'
import { explode, C4_BLAST } from '../explosions'
import { startFire } from '../hazards/fire'
import { isBurningAt } from '../hazards/hazards'
import { addGuard, addProp, bareWorld } from '../hazards/testWorld'
import { openDoor } from '../interact'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { cableAction, gasFittingAction, rigDoorAction, systemsAction, timerAction, valveAction } from './actions'
import { liquidAt } from './liquid'
import { addRoomOf, freshSystems, runAll } from './testKit'

/** A room over columns 2..41 (rows 17..21, floor on row 22), with a door at column 30. */
function roomWithDoor(): World {
  const world = freshSystems(bareWorld(60, 24))
  fillTiles(world.grid, 1, 16, 58, 16, 'concrete')
  fillTiles(world.grid, 30, 17, 30, 21, 'door')
  addRoomOf(world, 'restroom', 2, 17, 40, 5)
  return world
}

function standAt(world: World, x: number, facing: 1 | -1 = 1): void {
  Object.assign(world.player, { x: x - world.player.w / 2, y: 22 - world.player.h, vx: 0, vy: 0, facing })
}

describe('player-made traps', () => {
  it('a tap left running under a door plus a live cable pulled into the puddle drops the guard who walks in', () => {
    const world = roomWithDoor()
    fillTiles(world.grid, 30, 17, 30, 21, 'air')
    addProp(world, 'sink', 26, 22)
    addProp(world, 'conduitRun', 33, 18, 0)
    standAt(world, 26)
    expect(valveAction(world)?.prompt).toBe('E: open valve')
    systemsAction(world)!.run()
    runAll(world, 12)
    expect(liquidAt(world, 'water', 32, 21)).toBeGreaterThan(0)
    standAt(world, 33)
    const cable = cableAction(world)!
    expect(cable.hold).toBeGreaterThan(0)
    cable.run()
    standAt(world, 5)
    const guard = addGuard(world, 31.5, 22, -1)
    runAll(world, 0.6)
    expect(guard.stunSeconds).toBeGreaterThan(0)
  })

  it('a loosened gas fitting and the lights on a timer: the room goes up ten seconds later', () => {
    const world = roomWithDoor()
    const circuit = circuitOf('test', 0)
    addProp(world, 'stove', 10, 22, 0)
    world.devices.push({ kind: 'lightSwitch', x: 12, y: 19, circuit, id: 0, disabled: false, hacked: false })
    world.lamps.push({ x: 11.5, y: 17.2, fixture: 'fluorescentTube', color: 0xffffff, radius: 6, strength: 1, hung: true, circuit })
    standAt(world, 10)
    gasFittingAction(world)!.run()
    standAt(world, 12)
    timerAction(world)!.run()
    standAt(world, 45)
    let lit = -1
    runAll(world, 12, () => {
      if (lit < 0 && world.hazards.fires.size > 0) lit = world.clock
    })
    // Nothing to light it until the timer runs out.
    expect(lit).toBeGreaterThan(9)
  })

  it('C4 on a water tank above a burning room floods it and puts the fire out', () => {
    const world = freshSystems(bareWorld(60, 24))
    fillTiles(world.grid, 1, 14, 58, 14, 'concrete')
    addProp(world, 'waterTank', 20, 14)
    startFire(world, 22, 21, 1, 60)
    addProp(world, 'crate', 22, 22)
    // Two charges: one cuts the slab, the other bursts the tank.
    explode(world, { x: 20.5, y: 13.5 }, C4_BLAST)
    explode(world, { x: 20.5, y: 12.5 }, C4_BLAST)
    runAll(world, 6)
    expect(liquidAt(world, 'water', 22, 21)).toBeGreaterThan(0)
    expect(isBurningAt(world, { x: 22.5, y: 21.5 })).toBe(false)
  })

  it('a bucket wedged over a door lands on the guard who opens it', () => {
    const world = roomWithDoor()
    standAt(world, 28)
    rigDoorAction(world)!.run()
    runAll(world, 0.1)
    const guard = addGuard(world, 31, 22, -1)
    openDoor(world.grid, { x: 30, y: 19 })
    runAll(world, 0.1)
    expect(guard.stunSeconds).toBeGreaterThan(0)
    expect(world.systems.rigged).toHaveLength(0)
  })
})
