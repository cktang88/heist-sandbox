import { describe, expect, it } from 'vitest'
import { createWorld } from '../world'
import { feetOf } from './model'
import { stairCheck } from './patrol'
import { buildingAt, sameStretch } from './places'
import { run } from './testArena'
import { startSearch } from './orders'
import { landingX } from '../stairs'

describe('patrols looking into a stairwell', () => {
  it.each([1, 2, 3, 4])('seed %i: a patrol only ever checks the stairs of his own building', (seed) => {
    const world = createWorld(seed, 'complex')
    const strays: string[] = []
    world.guards.forEach((guard, index) => {
      if (guard.role !== 'patrol') return
      for (const point of guard.route) {
        Object.assign(guard, { x: point.x - guard.w / 2, y: point.y - guard.h })
        const landing = stairCheck(world, guard)
        const from = buildingAt(world, feetOf(guard))
        if (landing && buildingAt(world, landing) !== from) strays.push(`guard ${index} in ${from} to ${landing.x},${landing.y} in ${buildingAt(world, landing)}`)
      }
    })
    expect(strays).toEqual([])
  })

  it.each([1, 2, 3])('seed %i: a patrol never checks stairs across an elevator core on his own floor', (seed) => {
    const world = createWorld(seed, 'complex')
    const across: string[] = []
    let checks = 0
    world.guards.forEach((guard, index) => {
      if (guard.role !== 'patrol') return
      for (const point of guard.route) {
        Object.assign(guard, { x: point.x - guard.w / 2, y: point.y - guard.h })
        const landing = stairCheck(world, guard)
        if (!landing) continue
        checks += 1
        const feet = feetOf(guard)
        const well = world.stairwells.find((one) => one.stops.some((y, stop) => Math.abs(landingX(one, stop) - landing.x) < 0.01 && Math.abs(y - landing.y) < 0.01))!
        const here = well.stops.findIndex((y) => Math.abs(y - feet.y) < 0.5)
        if (!sameStretch(world, feet, { x: landingX(well, here), y: feet.y })) across.push(`guard ${index} at ${feet.x},${feet.y}`)
      }
    })
    expect(checks).toBeGreaterThan(0)
    expect(across).toEqual([])
  })
})

describe('going from one building to another', () => {
  it.each([1, 2])('seed %i: a guard on the top floor of a low building sent to a higher floor of the tower goes down to the street first', (seed) => {
    const world = createWorld(seed, 'complex')
    Object.assign(world.player, { x: world.extraction.x + 1, y: world.groundY - 1.7, hp: 1e6, chute: false })
    const well = world.stairwells.find((one) => one.building !== 'tower' && one.stops.length > 1 && Math.min(...one.stops) < world.groundY)!
    const top = Math.min(...well.stops)
    const stop = well.stops.indexOf(top)
    const room = world.rooms.find((one) => one.building === 'tower' && one.floorY < top - 6 && one.w > 8)!
    const guard = world.guards.find((one) => one.role === 'patrol')!
    Object.assign(guard, { x: landingX(well, stop) - guard.w / 2, y: top - guard.h - 0.01, vx: 0, vy: 0 })
    const goal = { x: room.x + room.w / 2, y: room.floorY }
    startSearch(world, guard, goal)
    const arrived = () => Math.abs(feetOf(guard).y - goal.y) < 0.1 && buildingAt(world, feetOf(guard)) === 'tower'
    run(world, 120, {}, arrived)
    expect(arrived()).toBe(true)
  })
})

describe('getting back across a floor cut by a void', () => {
  it.each([1, 2])('seed %i: a patrol left on the far side of a double-height void goes round by the stairs to his route', (seed) => {
    const world = createWorld(seed, 'complex')
    const splits = world.stairwells.flatMap((well) => (well.bounds?.splits ?? []).map((split) => ({ ...split, building: well.building })))
    const cases = world.guards.flatMap((guard) => {
      if (guard.role !== 'patrol' || guard.route.length < 2) return []
      const split = splits.find((one) => Math.abs(one.y - guard.route[0].y) < 0.5 && guard.route.every((point) => point.x < one.from) && buildingAt(world, guard.route[0]) === one.building)
      return split ? [{ guard, far: split.to + 2.5 }] : []
    })
    expect(cases.length).toBeGreaterThan(0)
    const { guard, far } = cases[0]
    const floorY = guard.route[0].y
    // The player waits by the van, out of everyone's way.
    Object.assign(world.player, { x: world.extraction.x + 1, y: world.groundY - 1.7, hp: 1e6, chute: false })
    Object.assign(guard, { x: far - guard.w / 2, y: floorY - guard.h - 0.01, vx: 0, vy: 0 })
    const xs = guard.route.map((point) => point.x)
    const home = () => Math.abs(feetOf(guard).y - floorY) < 0.1 && feetOf(guard).x <= Math.max(...xs) + 1
    run(world, 90, {}, home)
    expect(home()).toBe(true)
  })
})
