import { describe, expect, it } from 'vitest'
import { createWorld } from '../world'
import { feetOf } from './model'
import { stairCheck } from './patrol'
import { buildingAt } from './places'
import { run } from './testArena'

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
})

describe('getting back across a floor cut by a void', () => {
  it.each([1, 2])('seed %i: a patrol left on the far side of a double-height void goes round by the stairs to his route', (seed) => {
    const world = createWorld(seed, 'complex')
    const splits = world.stairwells.flatMap((well) => well.bounds?.splits.map((split) => ({ ...split, building: well.building })) ?? [])
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
