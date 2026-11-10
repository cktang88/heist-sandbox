import { describe, expect, it } from 'vitest'
import { explode } from './explosions'
import { throwFrag } from './frag/frag'
import { stepAftermath } from './frag/aftermath'
import { addGuard, bareWorld } from './hazards/testWorld'
import { idleInput } from './input'
import { nextHop } from './nav'
import { movePlayer } from './player'
import type { Stairwell } from './site'
import { breakFlight, climbStairs, findLanding, landingX, splitWell, stairPoint, type OnStairs } from './stairs'
import type { Body } from './types'
import { boxHitsSolid } from './physics'
import { stepWorld } from './step'
import { createWorld, type World } from './world'

const well: Stairwell = { id: 0, building: 'test', leftX: 10, rightX: 20, stops: [100, 94, 88, 82] }

describe('stairs', () => {
  it('zigzags between the left and right landings', () => {
    expect(landingX(well, 0)).toBe(10)
    expect(landingX(well, 1)).toBe(20)
    expect(stairPoint(well, 0.5)).toEqual({ x: 15, y: 97 })
    expect(stairPoint(well, 1.5)).toEqual({ x: 15, y: 91 })
  })

  it('finds the landing someone is standing at', () => {
    expect(findLanding([well], 10.3, 100)?.stop).toBe(0)
    expect(findLanding([well], 20, 94.2)?.stop).toBe(1)
    expect(findLanding([well], 15, 100)).toBeNull()
  })

  it('climbs one flight and stops at the next landing', () => {
    const body: Body = { x: 0, y: 0, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: true }
    const on: OnStairs = { well: 0, u: 0 }
    let frames = 0
    while (climbStairs(body, on, well, 1, false, 1 / 60) && frames < 600) frames += 1
    expect(on.u).toBe(1)
    expect(body.y + body.h).toBeCloseTo(94)
    expect(frames).toBeGreaterThan(30)
  })

  it('carries on through landings while the climber keeps going', () => {
    const body: Body = { x: 0, y: 0, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: true }
    const on: OnStairs = { well: 0, u: 0 }
    let frames = 0
    while (climbStairs(body, on, well, 1, true, 1 / 60) && frames < 2000) frames += 1
    expect(on.u).toBe(3)
  })

  it('plans a route: walk to the landing, then take the stairs, then walk to the goal', () => {
    expect(nextHop([well], { x: 30, y: 100 }, { x: 5, y: 88 })).toEqual({ kind: 'walk', x: 10 })
    expect(nextHop([well], { x: 10.2, y: 100 }, { x: 5, y: 88 })).toMatchObject({ kind: 'stairs', stop: 0, direction: 1 })
    expect(nextHop([well], { x: 20, y: 88 }, { x: 5, y: 88 })).toEqual({ kind: 'walk', x: 5 })
    expect(nextHop([well], { x: 20, y: 60 }, { x: 5, y: 88 })).toEqual({ kind: 'none' })
  })
})

describe('destroyed flights', () => {
  function world(): World {
    const made = bareWorld(40, 104)
    made.stairwells = [{ ...well, stops: [...well.stops] }]
    return made
  }

  it('splits a staircase where a flight is gone, keeping every landing where it was', () => {
    const pieces = splitWell(well, 1, 7)
    expect(pieces.map((piece) => piece.stops)).toEqual([[100, 94], [88, 82]])
    expect(pieces[1].id).toBe(7)
    expect(landingX(pieces[1], 0)).toBe(landingX(well, 2))
    expect(landingX(pieces[1], 1)).toBe(landingX(well, 3))
    // An upper piece starting on a right-hand landing swaps its sides.
    const upper = splitWell(well, 0, 7)
    expect(upper.map((piece) => piece.stops)).toEqual([[94, 88, 82]])
    expect(stairPoint(upper[0], 0.5)).toEqual(stairPoint(well, 1.5))
  })

  it('drops whoever is on the flight, carries on whoever is above it, and nobody can path across it', () => {
    const made = world()
    const guard = addGuard(made, 15, 88, 1)
    guard.stairs = { well: 0, u: 2.5 }
    made.player.stairs = { well: 0, u: 1.4 }
    breakFlight(made, 0, 1)
    expect(made.player.stairs).toBeNull()
    expect(made.player.onGround).toBe(false)
    const upper = made.stairwells.find((piece) => piece.id === guard.stairs!.well)!
    expect(stairPoint(upper, guard.stairs!.u)).toEqual(stairPoint(well, 2.5))
    expect(nextHop(made.stairwells, { x: 10, y: 100 }, { x: 10, y: 88 })).toMatchObject({ kind: 'stairs', stop: 0 })
    expect(nextHop(made.stairwells, { x: 20, y: 94 }, { x: 10, y: 88 })).toEqual({ kind: 'none' })
    expect(findLanding(made.stairwells, 20, 94)?.well.stops).toEqual([100, 94])
  })

  it('drops a frag rattling down the broken flight, and moves one further up onto the upper piece', () => {
    const made = world()
    throwFrag(made, { x: 15, y: 90 }, { x: 1, y: 0 })
    throwFrag(made, { x: 15, y: 90 }, { x: 1, y: 0 })
    const [falling, above] = made.frags
    falling.stairs = { well: 0, u: 1.4 }
    above.stairs = { well: 0, u: 2.5 }
    breakFlight(made, 0, 1)
    expect(falling.stairs).toBeNull()
    const upper = made.stairwells.find((piece) => piece.id === above.stairs!.well)!
    expect(stairPoint(upper, above.stairs!.u)).toEqual(stairPoint(well, 2.5))
  })

  it('a player left at the broken end cannot climb on', () => {
    const made = world()
    breakFlight(made, 0, 1)
    const player = made.player
    Object.assign(player, { x: 20 - player.w / 2, y: 94 - player.h, onGround: true })
    movePlayer(made.grid, player, { ...idleInput({ x: 25, y: 90 }), up: true }, 1 / 60, made.stairwells)
    expect(player.stairs).toBeNull()
  })

  it('an explosion close to a flight blows it away and leaves the others', () => {
    const made = world()
    explode(made, stairPoint(well, 2.5), { radius: 3, tileDamage: 50, bodyDamage: 50 })
    stepAftermath(made)
    expect(made.stairwells.map((piece) => piece.stops)).toEqual([[100, 94, 88]])
  })
})

describe('leaving a flight between landings', () => {
  /** The player partway up a flight of the complex's first staircase, where it crosses the slab of the storey above. */
  function partwayUp(along: number): World {
    const world = createWorld(1, 'complex')
    world.guards = []
    const tower = world.stairwells[0]
    Object.assign(world.player, { x: landingX(tower, 2) - world.player.w / 2, y: tower.stops[2] - world.player.h - 0.01, vx: 0, vy: 0, hp: 1e6 })
    const run = (input = {}) => stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, 1 / 60)
    for (let frame = 0; frame < 12; frame += 1) run()
    for (let frame = 0; frame < 300 && (world.player.stairs?.u ?? 2) - 2 < along; frame += 1) run({ up: true })
    return world
  }

  it.each([0.3, 0.5, 0.7, 0.9])('jumping off %s of the way up never leaves the player inside the floor slab', (along) => {
    const world = partwayUp(along)
    expect(world.player.stairs).not.toBeNull()
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), up: true, jumpPressed: true, jumpHeld: true }, 1 / 60)
    expect(world.player.stairs).toBeNull()
    for (let frame = 0; frame < 60; frame += 1) {
      stepWorld(world, idleInput({ x: world.player.x + 5, y: world.player.y }), 1 / 60)
      expect(boxHitsSolid(world.grid, world.player)).toBe(false)
    }
    expect(world.player.onGround).toBe(true)
  })

  it('a flight blown away under the player drops him clear of the slab it crossed', () => {
    const world = partwayUp(0.7)
    breakFlight(world, world.player.stairs!.well, 2)
    expect(world.player.stairs).toBeNull()
    expect(boxHitsSolid(world.grid, world.player)).toBe(false)
  })
})

describe('shooting on the stairs', () => {
  it('recoil and spread settle while climbing, as they do on the floor', () => {
    const body = bareWorld(40, 120)
    body.stairwells = [well]
    Object.assign(body.player, { x: 10 - body.player.w / 2, y: 100 - body.player.h, onGround: true, kick: 1, bloom: 0.14 })
    for (let frame = 0; frame < 60; frame += 1) movePlayer(body.grid, body.player, { ...idleInput({ x: 30, y: 90 }), up: true }, 1 / 60, body.stairwells)
    expect(body.player.stairs).not.toBeNull()
    expect(body.player.kick).toBeLessThan(0.01)
    expect(body.player.bloom).toBe(0)
  })
})

describe('footsteps on the stairs', () => {
  function climbing(crouch: boolean) {
    const world = bareWorld(40, 120)
    world.stairwells = [well]
    Object.assign(world.player, { x: 10 - world.player.w / 2, y: 100 - world.player.h, onGround: true })
    for (let frame = 0; frame < 60; frame += 1) movePlayer(world.grid, world.player, { ...idleInput({ x: 30, y: 90 }), up: true, crouch }, 1 / 60, world.stairwells)
    expect(world.player.stairs).not.toBeNull()
    return world.player.footfalls
  }

  it('running up a flight is heard step by step; creeping up crouched is silent', () => {
    expect(climbing(false).length).toBeGreaterThanOrEqual(2)
    expect(climbing(true)).toEqual([])
  })
})
