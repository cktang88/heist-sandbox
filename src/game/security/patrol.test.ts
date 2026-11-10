import { describe, expect, it } from 'vitest'
import { createWorld } from '../world'
import { feetOf } from './model'
import { stairCheck } from './patrol'
import { buildingAt } from './places'

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
