import { describe, expect, it } from 'vitest'
import { doorColumn } from './elevators'
import { idleInput, type Input } from './input'
import { GROUND } from './level'
import { stepWorld } from './step'
import { tileAt } from './tiles'
import { createWorld, type Device, type World } from './world'

/** Scripted play: what the single E key does, and whether its hint tells the truth. */

const FRAME = 1 / 60

function play(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

function press(world: World): void {
  play(world, FRAME, { interact: true, interactPressed: true })
}

function placePlayer(world: World, x: number, feetY: number): void {
  Object.assign(world.player, { x: x - world.player.w / 2, y: feetY - world.player.h - 0.01, vx: 0, vy: 0, chute: false, hp: 1e6 })
}

function addCamera(world: World, x: number, y: number): Device {
  const camera: Device = { kind: 'camera', x, y, facing: 1, id: world.devices.length, disabled: false, hacked: false }
  world.devices.push(camera)
  return camera
}

describe('the E key with several things in reach', () => {
  it('calls the elevator at a lobby door even with a camera on the ceiling above', () => {
    const world = createWorld(1, 'complex')
    world.guards = []
    const shaft = world.elevators[0]
    const car = world.elevatorCars[0]
    const door = doorColumn(shaft)
    placePlayer(world, door + 0.5 + shaft.doorSide * 1.5, world.groundY)
    addCamera(world, door + shaft.doorSide * 2, world.groundY - 4)
    play(world, 0.1)
    expect(world.prompt).toBe('E: call elevator')
    press(world)
    play(world, 8)
    expect(car.y).toBe(world.groundY)
    expect(car.doorsOpen).toBe(true)
  })

  it('picks the lock in front of the player even with a camera on the ceiling above', () => {
    const world = createWorld(1)
    world.guards = []
    placePlayer(world, 68.55, GROUND)
    addCamera(world, 67, GROUND - 4)
    play(world, 0.1)
    expect(world.prompt).toBe('Hold E: pick lock')
    play(world, 2, { interact: true })
    expect(tileAt(world.grid, 70, GROUND - 1)).toBe('air')
  })

  it('still cuts a camera cable when nothing at arm\'s length competes', () => {
    const world = createWorld(1)
    world.guards = []
    placePlayer(world, 40.5, GROUND)
    const camera = addCamera(world, 40, GROUND - 4)
    play(world, 0.1)
    expect(world.prompt).toBe('Hold E: cut camera cable')
    play(world, 1.2, { interact: true })
    expect(camera.disabled).toBe(true)
  })
})
