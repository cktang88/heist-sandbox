import { describe, expect, it } from 'vitest'
import { callElevator, doorColumn, groundStop, shaftHead, type ElevatorCar } from './elevators'
import { explode } from './explosions'
import { GUNS } from './guns'
import { fireShot } from './projectiles'
import { elevatorsRecalled, isLockedDown } from './security/dispatch'
import { raiseLevel, reportEvent } from './security/report'
import { createGuard, hurtGuard } from './guards'
import { knockOutCold } from './stealth/bodies'
import { throwFrag } from './frag/frag'
import { idleInput, type Input } from './input'
import type { ElevatorShaft } from './site'
import { roomAt } from './site'
import { stepWorld } from './step'
import { isSolidAt, tileAt } from './tiles'
import { createWorld, type World } from './world'
import { DRONE_PROMPT } from './drone'
import { toolIndex } from './toolDefs'
import { propBox } from './hazards/props'
import { isPushable } from './physprops/kinds'
import { loosen, shiftProp } from './physprops/state'

const FRAME = 1 / 60

function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
    expect(world.falling).toHaveLength(0)
  }
}

function press(world: World, input: Partial<Input> = {}): void {
  run(world, FRAME, { interact: true, interactPressed: true, ...input })
}

const feet = (world: World) => world.player.y + world.player.h

/** The complex's tower elevator, with every guard sent home and no camera by a door to steal the "E" prompt. */
function setUp(index = 0): { world: World; shaft: ElevatorShaft; car: ElevatorCar } {
  const world = createWorld(1, 'complex')
  world.guards = []
  for (const device of world.devices) if (device.kind === 'camera') device.disabled = true
  world.player.hp = 1e6
  return { world, shaft: world.elevators[index], car: world.elevatorCars[index] }
}

/** Stands the player just outside the shaft door at a stop. */
function standAtDoor(world: World, shaft: ElevatorShaft, stop: number): void {
  const x = doorColumn(shaft) + (shaft.doorSide === 1 ? 1.2 : -0.9)
  Object.assign(world.player, { x, y: shaft.stops[stop] - world.player.h, vx: 0, vy: 0 })
  run(world, 0.2)
}

/** A stop from the ground up whose landing, and the one two stops higher, have solid floor outside the doors. */
function rideableStop(world: World, shaft: ElevatorShaft): number {
  const landed = (stop: number) => [1, 2, 3].every((step) => isSolidAt(world.grid, doorColumn(shaft) + shaft.doorSide * step, shaft.stops[stop]))
  for (let stop = groundStop(world, shaft); stop + 2 < shaft.stops.length; stop += 1) if (landed(stop) && landed(stop + 2)) return stop
  throw new Error('no landing to ride between')
}

function carRow(world: World, shaft: ElevatorShaft, y: number): string[] {
  const row: string[] = []
  for (let x = shaft.x; x < shaft.x + shaft.w; x += 1) row.push(tileAt(world.grid, x, y))
  return row
}

describe('elevators', () => {
  // The tower's west-wall shaft opens to the right, the quarters' (the last one built) to the left.
  it.each([0, 3])('comes when called, lets the player ride up two stops and walk out on that floor (shaft %i)', (index) => {
    const { world, shaft, car } = setUp(index)
    const start = rideableStop(world, shaft)
    const pitRow = carRow(world, shaft, shaft.stops[0])
    standAtDoor(world, shaft, start)
    expect(world.prompt).toBe('E: call elevator')

    press(world)
    run(world, 0.5)
    expect(car.moving).toBe(true)
    expect(carRow(world, shaft, shaft.stops[0])).toEqual(pitRow)
    run(world, 6)
    expect(car.stop).toBe(start)
    expect(car.doorsOpen).toBe(true)
    expect(carRow(world, shaft, shaft.stops[start])).toEqual(Array(shaft.w).fill('reinforced'))
    for (let y = shaft.stops[start] - 3; y < shaft.stops[start]; y += 1) expect(tileAt(world.grid, doorColumn(shaft), y)).toBe('air')

    run(world, 1.5, { left: shaft.doorSide === 1, right: shaft.doorSide === -1 })
    expect(world.prompt).toBe('W/S: ride elevator')
    const shaftRowBefore = carRow(world, shaft, shaft.stops[start])
    expect(shaftRowBefore.every((kind) => kind === 'reinforced')).toBe(true)

    run(world, 1.5, { up: true })
    expect(car.moving).toBe(true)
    // While the car travels it is not tiles: its old floor is gone and the doors it left are shut.
    expect(carRow(world, shaft, shaft.stops[start])).not.toContain('reinforced')
    expect(tileAt(world.grid, doorColumn(shaft), shaft.stops[start] - 1)).toBe('door')
    expect(Math.abs(feet(world) - car.y)).toBeLessThan(0.05)
    run(world, 2)
    expect(car.moving).toBe(false)
    expect(car.stop).toBe(start + 2)
    expect(Math.abs(feet(world) - shaft.stops[start + 2])).toBeLessThan(0.05)

    run(world, 1.5, { right: shaft.doorSide === 1, left: shaft.doorSide === -1 })
    const outside = (world.player.x + world.player.w / 2 - (doorColumn(shaft) + 0.5)) * shaft.doorSide
    expect(outside).toBeGreaterThan(0.5)
    expect(world.player.onGround).toBe(true)
    expect(Math.abs(feet(world) - shaft.stops[start + 2])).toBeLessThan(0.05)
  })

  it('stops answering calls at alert level 2 until a terminal releases it', () => {
    const { world, shaft, car } = setUp()
    const ground = groundStop(world, shaft)
    const caller = ground + 2
    world.security.level = 2
    standAtDoor(world, shaft, caller)
    expect(world.prompt).not.toBe('E: call elevator')
    press(world)
    run(world, 6)
    expect(car.stop).toBe(ground)

    // Only a server room's (or security room's) terminal can release the elevators.
    const room = roomAt(world.rooms, world.player.x + 2, shaft.stops[caller] - 1)!
    room.kind = 'server'
    world.devices.push({ kind: 'computer', x: Math.floor(world.player.x + 0.35), y: shaft.stops[caller], roomId: room.id, id: world.devices.length, disabled: false, hacked: false })
    run(world, 1.6, { interact: true })
    const options = world.terminal!.options
    run(world, FRAME, { selectTool: options.indexOf('Release elevators') })
    press(world)
    expect(world.terminal).toBeNull()
    world.devices.pop()
    run(world, FRAME)
    expect(world.prompt).toBe('E: call elevator')
    press(world)
    run(world, 4)
    expect(car.stop).toBe(caller)
    expect(car.doorsOpen).toBe(true)
  })

  it('obeys the security force: recalled once an intruder is reported, frozen in lockdown', () => {
    const { world, shaft, car } = setUp()
    const ground = groundStop(world, shaft)
    const start = rideableStop(world, shaft) + 2
    callElevator(world, car, start)
    run(world, 8)
    expect(car.stop).toBe(start)
    expect(elevatorsRecalled(world)).toBe(false)

    reportEvent(world, { kind: 'sighting', at: { x: 150, y: shaft.stops[start] - 1 }, by: 0 })
    expect(world.security.level).toBe(3)
    expect(elevatorsRecalled(world)).toBe(true)
    expect(isLockedDown(world)).toBe(false)
    expect(callElevator(world, car, start)).toBe(false)
    run(world, 1)
    expect(car.moving).toBe(true)

    raiseLevel(world, 4)
    expect(isLockedDown(world)).toBe(true)
    run(world, FRAME)
    const frozenAt = car.y
    run(world, 3)
    expect(car.moving).toBe(false)
    expect(car.y).toBe(frozenAt)
    expect(car.stop).not.toBe(ground)
  })

  it('stalls between floors at alert level 4 without leaving its passengers hanging', () => {
    const { world, shaft, car } = setUp()
    const start = rideableStop(world, shaft)
    standAtDoor(world, shaft, start)
    press(world)
    run(world, 6)
    run(world, 1.5, { left: shaft.doorSide === 1, right: shaft.doorSide === -1 })
    run(world, 0.5, { up: true })
    expect(car.moving).toBe(true)
    world.security.level = 4
    run(world, FRAME)
    expect(car.moving).toBe(false)
    const stalledAt = car.y
    expect(Number.isInteger(stalledAt)).toBe(true)
    expect(carRow(world, shaft, stalledAt).every((kind) => kind === 'reinforced')).toBe(true)
    run(world, 2)
    expect(world.player.onGround).toBe(true)
    expect(Math.abs(feet(world) - stalledAt)).toBeLessThan(0.05)
    expect(car.riders).toHaveLength(0)
  })

  it('ignores W while the keys fly the drone or the rider is knocked down', () => {
    const { world, shaft, car } = setUp()
    Object.assign(world.player, { x: shaft.x + 0.5, y: shaft.stops[car.stop!] - world.player.h - 0.01, vx: 0, vy: 0 })
    run(world, 0.3)
    expect(world.prompt).toBe('W/S: ride elevator')
    world.player.tool = toolIndex('drone')
    run(world, FRAME, { fire: true, firePressed: true })
    run(world, 1, { up: true })
    expect(car.moving).toBe(false)
    expect(world.prompt).toBe(DRONE_PROMPT)

    run(world, FRAME, { interact: true, interactPressed: true })
    expect(world.drone).toBeNull()
    world.player.stunSeconds = 1
    run(world, 0.5, { up: true })
    expect(car.moving).toBe(false)
    run(world, 1, { up: true })
    expect(car.moving).toBe(true)
  })

  it('carries loose furniture standing on the car instead of dropping it down the shaft', () => {
    const { world, shaft, car } = setUp()
    const prop = world.props.find((candidate) => isPushable(candidate.kind) && propBox(candidate).w < shaft.w - 0.5)!
    const box = propBox(prop)
    shiftProp(prop, shaft.x + 0.3 - box.x, car.y - (box.y + box.h))
    loosen(world, prop)
    run(world, 0.3)
    expect(propBox(prop).y + propBox(prop).h).toBeCloseTo(car.y, 1)
    const target = car.stop! + 2
    car.targetStop = target
    run(world, 6)
    expect(car.stop).toBe(target)
    expect(car.moving).toBe(false)
    expect(propBox(prop).y + propBox(prop).h).toBeCloseTo(car.y, 1)
  })

  it('carries a guard standing in the car and crushes one underneath it', () => {
    const { world, shaft, car } = setUp()
    const ground = groundStop(world, shaft)
    const rider = createGuard({ x: shaft.x + 1, y: shaft.stops[0], facing: 1 })
    world.guards = [rider]
    Object.assign(world.player, { x: 20, y: world.groundY - world.player.h })
    car.targetStop = ground
    run(world, 5)
    expect(car.stop).toBe(ground)
    expect(Math.abs(rider.y + rider.h - shaft.stops[ground])).toBeLessThan(0.05)

    const victim = createGuard({ x: shaft.x + 1, y: shaft.stops[0], facing: 1 })
    world.guards = [victim]
    car.targetStop = 0
    run(world, 5)
    expect(victim.state).toBe('dead')
  })
})

describe('elevators carry what lies on the car floor', () => {
  it('bodies, the case, pickups, a charge and a grenade on the floor ride with the car', () => {
    const { world, shaft, car } = setUp()
    Object.assign(world.player, { x: 20, y: world.groundY - world.player.h })
    run(world, 0.3)
    const floor = car.y
    const middle = shaft.x + shaft.w / 2
    const dead = createGuard({ x: middle - 1, y: floor, facing: 1 })
    hurtGuard(world, dead, 1e4, { x: middle, y: floor - 1 })
    const tied = createGuard({ x: middle, y: floor, facing: 1 })
    world.guards = [dead, tied]
    knockOutCold(world, tied, 1e4)
    tied.restrained = true
    Object.assign(world.loot, { x: middle - 0.4, y: floor - world.loot.h, vx: 0, vy: 0, taken: false })
    const pickup = world.pickups[0]
    Object.assign(pickup, { x: middle + 0.2, y: floor - pickup.h, vx: 0, vy: 0, taken: false })
    world.charges.push({ x: middle - 0.2, y: floor - 0.401, w: 0.4, h: 0.4, vx: 0, vy: 0, onGround: true, fuse: null, stuck: { x: Math.floor(middle), y: floor } })
    throwFrag(world, { x: middle, y: floor - 0.5 }, { x: 0, y: 1 })
    world.frags[0].fuse = 1e4
    run(world, 2)
    const target = car.stop! + 2
    car.targetStop = target
    run(world, 0.5)
    expect(car.moving).toBe(true)
    run(world, 6)
    expect(car.stop).toBe(target)
    const onCar = (bottom: number) => Math.abs(bottom - car.y) < 0.6
    for (const guard of [dead, tied]) expect(guard.ragdoll!.points.every((point) => point.y <= car.y + 0.05 && point.y > car.y - 2)).toBe(true)
    expect(onCar(world.loot.y + world.loot.h)).toBe(true)
    expect(onCar(pickup.y + pickup.h)).toBe(true)
    expect(onCar(world.charges[0].y + world.charges[0].h)).toBe(true)
    expect(onCar(world.frags[0].y + world.frags[0].h)).toBe(true)
    run(world, 2)
    expect(onCar(world.loot.y + world.loot.h)).toBe(true)
    expect(dead.ragdoll!.points.every((point) => point.y <= car.y + 0.05)).toBe(true)
  })
})

describe('elevator sabotage', () => {
  /** The tower car parked two stops above the street with the player inside, and a guard down in the pit. */
  function rideHigh() {
    const { world, shaft, car } = setUp()
    const high = groundStop(world, shaft) + 2
    car.targetStop = high
    run(world, 12)
    expect(car.stop).toBe(high)
    Object.assign(world.player, { x: shaft.x + 1, y: car.y - world.player.h, vx: 0, vy: 0 })
    run(world, 0.2)
    const victim = createGuard({ x: shaft.x + 1, y: shaft.stops[0], facing: 1 })
    world.guards = [victim]
    return { world, shaft, car, high, victim }
  }

  it('an explosion at the head of the shaft cuts the cable: the car drops, crashes, and never runs again', () => {
    const { world, shaft, car, high, victim } = rideHigh()
    const hp = world.player.hp
    explode(world, shaftHead(shaft), { radius: 2, tileDamage: 1, bodyDamage: 10 })
    run(world, FRAME)
    expect(car.cut).toBe(true)
    expect(car.moving).toBe(true)
    expect(carRow(world, shaft, shaft.stops[high]).includes('reinforced')).toBe(false)
    run(world, 3)
    expect(car.moving).toBe(false)
    expect(car.y).toBe(shaft.stops[0])
    expect(world.player.hp).toBeLessThan(hp)
    expect(Math.abs(feet(world) - shaft.stops[0])).toBeLessThan(0.05)
    expect(victim.state).toBe('dead')
    expect(world.sounds.some((sound) => sound.kind === 'collapse')).toBe(true)
    expect(callElevator(world, car, high, true)).toBe(false)
    run(world, 1)
    expect(car.y).toBe(shaft.stops[0])
  })

  it('takes six bullets into the winding gear to cut the cable', () => {
    const { world, shaft, car } = rideHigh()
    Object.assign(world.player, { x: 20, y: world.groundY - world.player.h })
    const head = shaftHead(shaft)
    const shoot = () => {
      fireShot(world, { x: head.x, y: head.y + 3 }, { x: 0, y: -1 }, GUNS.pistol!.shot)
      run(world, 0.1)
    }
    for (let shot = 0; shot < 5; shot += 1) shoot()
    expect(car.cut).toBeFalsy()
    shoot()
    expect(car.cut).toBe(true)
    run(world, 3)
    expect(car.y).toBe(shaft.stops[0])
  })

  it('ignores bullets that a wall stops before the gear', () => {
    const { world, shaft, car } = rideHigh()
    const head = shaftHead(shaft)
    const wall = doorColumn(shaft) + shaft.doorSide * 3
    for (let shot = 0; shot < 8; shot += 1) {
      fireShot(world, { x: wall + 0.5, y: head.y + 8 }, { x: head.x - wall, y: -8 }, GUNS.pistol!.shot)
      run(world, 0.1)
    }
    expect(car.cut).toBeFalsy()
  })
})
