import { describe, expect, it } from 'vitest'
import { callElevator, doorColumn, groundStop } from '../elevators'
import { C4_BLAST, explode } from '../explosions'
import { createGuard } from '../guards'
import { idleInput, type Input } from '../input'
import { openDoor } from '../interact'
import { GRAVITY, moveBody } from '../physics'
import { stepWorld } from '../step'
import { isSolidAt, tileAt } from '../tiles'
import type { Body } from '../types'
import type { ElevatorShaft } from '../site'
import { createWorld, type World } from '../world'
import { depthOffsetFor, FRONT_LANE } from './depth'
import { stepGaps } from './gaps'

const FRAME = 1 / 60

function quietComplex(): World {
  const world = createWorld(1, 'complex')
  world.guards = []
  world.player.hp = 1e6
  return world
}

function stand(body: Body, x: number, feetY: number): void {
  Object.assign(body, { x: x - body.w / 2, y: feetY - body.h - 0.01, vx: 0, vy: 0, onGround: true })
}

function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    world.player.hp = 1e6
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

const feetOf = (body: Body): number => body.y + body.h

/** The tower's elevator shaft and its west street door, which opens straight onto the shaft. */
function towerShaft(world: World) {
  const shaft = world.elevators.find((candidate) => candidate.building === 'tower')!
  const street = shaft.stops[groundStop(world, shaft)]
  const outerWall = shaft.doorSide === 1 ? shaft.x - 1 : shaft.x + shaft.w
  openDoor(world.grid, { x: outerWall, y: street - 1 })
  return { shaft, street, outerWall, door: doorColumn(shaft) }
}

/** Walks the player in from the lobby side of the shaft door to stand over the middle of the shaft. */
function walkOver(world: World, shaft: ElevatorShaft, street: number): void {
  const side = shaft.doorSide
  stand(world.player, doorColumn(shaft) + 0.5 + side * 1.5, street)
  run(world, 0.1)
  const middle = shaft.x + shaft.w / 2
  for (let frame = 0; frame < 120 && Math.abs(world.player.x + world.player.w / 2 - middle) > 0.3; frame += 1) {
    run(world, FRAME, side === 1 ? { left: true } : { right: true })
  }
  run(world, 0.3)
}

describe('walking past an elevator shaft', () => {
  it('takes the player in at the tower street door and past the shaft to the lobby, on the street level', () => {
    const world = quietComplex()
    const { street, outerWall, door, shaft } = towerShaft(world)
    const side = shaft.doorSide
    stand(world.player, outerWall - side * 1.5, street)
    run(world, 0.1)
    run(world, 1.2, side === 1 ? { right: true } : { left: true })
    expect((world.player.x + world.player.w / 2 - (door + 0.5)) * side).toBeGreaterThan(1)
    expect(feetOf(world.player)).toBeCloseTo(street, 1)
  })

  it('draws someone over the shaft in front of it, and lets them drop in only by holding down', () => {
    const world = quietComplex()
    const { street, shaft } = towerShaft(world)
    walkOver(world, shaft, street)
    expect(feetOf(world.player)).toBeCloseTo(street, 1)
    expect(depthOffsetFor(world, world.player)).toBeCloseTo(FRONT_LANE)
    run(world, 1, { down: true })
    expect(feetOf(world.player)).toBeGreaterThan(street + 3)
  })

  it('lets a car go by behind someone standing in front of the shaft', () => {
    const world = quietComplex()
    const { street, shaft } = towerShaft(world)
    const car = world.elevatorCars.find((candidate) => candidate.shaft === shaft.id)!
    walkOver(world, shaft, street)
    const top = shaft.stops.length - 1
    expect(callElevator(world, car, top, true)).toBe(true)
    run(world, 5)
    expect(car.moving).toBe(true)
    expect(car.y).toBeLessThan(street - 3)
    expect(feetOf(world.player)).toBeCloseTo(street, 1)
    expect(car.riders).not.toContain(world.player)
  })

  it('is walked past by a guard on his way through', () => {
    const world = quietComplex()
    const { street, outerWall, door, shaft } = towerShaft(world)
    const side = shaft.doorSide
    const guard = createGuard({ x: outerWall - side * 1.5, y: street, facing: side })
    world.guards.push(guard)
    for (let frame = 0; frame < 240; frame += 1) {
      guard.vx = frame < 6 ? 0 : side * 3
      guard.vy += GRAVITY * FRAME
      moveBody(world.grid, guard, FRAME)
      stepGaps(world, idleInput({ x: 0, y: 0 }))
    }
    expect((guard.x + guard.w / 2 - (door + 0.5)) * side).toBeGreaterThan(1)
    expect(feetOf(guard)).toBeCloseTo(street, 1)
  })
})

describe('watchtowers', () => {
  /** The watchtower nearest the west fence: its left leg column and its deck row. */
  function watchtower(world: World): { leg: number; deck: number } {
    const ground = world.groundY
    for (let x = 30; x < 80; x += 1) {
      if (isSolidAt(world.grid, x, ground - 1) && tileAt(world.grid, x + 2, ground - 1) === 'ladder' && isSolidAt(world.grid, x + 4, ground - 1)) return { leg: x, deck: ground - 10 }
    }
    for (let x = world.grid.width - 30; x > 200; x -= 1) {
      if (isSolidAt(world.grid, x, ground - 1) && tileAt(world.grid, x + 2, ground - 1) === 'ladder' && isSolidAt(world.grid, x + 4, ground - 1)) return { leg: x, deck: ground - 10 }
    }
    throw new Error('no watchtower')
  }

  it('lets people walk between its legs, drawn in front of them', () => {
    const world = quietComplex()
    const { leg } = watchtower(world)
    stand(world.player, leg - 1.5, world.groundY)
    run(world, 0.1)
    let inFront = false
    for (let frame = 0; frame < 60; frame += 1) {
      run(world, FRAME, { right: true })
      if (depthOffsetFor(world, world.player) > 0.5) inFront = true
    }
    expect(world.player.x).toBeGreaterThan(leg + 5)
    expect(inFront).toBe(true)
  })

  it('still stops bullets at its legs', () => {
    const world = quietComplex()
    const { leg } = watchtower(world)
    expect(isSolidAt(world.grid, leg, world.groundY - 2)).toBe(true)
  })

  it('can be brought down by blowing its legs', () => {
    const world = quietComplex()
    const { leg, deck } = watchtower(world)
    stand(world.player, 5, world.groundY)
    for (const x of [leg, leg + 2, leg + 4]) explode(world, { x: x + 0.5, y: world.groundY - 4 }, C4_BLAST)
    run(world, 3)
    expect(world.falling).toEqual([])
    expect(tileAt(world.grid, leg + 1, deck)).toBe('air')
  })
})
