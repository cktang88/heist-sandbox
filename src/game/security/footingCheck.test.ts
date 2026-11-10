import { describe, expect, it } from 'vitest'
import { startLeak } from '../hazards/gas'
import { tileKey } from '../hazards/state'
import { addSource } from '../systems/sources'
import { pourLiquid } from '../systems/liquid'
import { stepBlocked, wadeIntoFlood } from './footingCheck'
import { feetOf } from './model'
import { addGuard, arena, GROUND, putPlayer, run } from './testArena'

/** Guards and the chain-reaction hazards: they keep off live water and out of gas, and turn off a flood's taps. */

function patrol(world: ReturnType<typeof arena>, from: number, to: number) {
  const guard = addGuard(world, from, 1, 'patrol')
  guard.route = [{ x: from + 0.5, y: GROUND }, { x: to + 0.5, y: GROUND }]
  return guard
}

describe('guards and hazards underfoot', () => {
  it('the step onto water carrying current is one he will not take', () => {
    const world = arena()
    const guard = addGuard(world, 43.2, 1, 'patrol')
    expect(stepBlocked(world, guard)).toBe(false)
    world.systems.energized.set(tileKey(world, 44, GROUND - 1), undefined)
    expect(stepBlocked(world, guard)).toBe(true)
    guard.facing = -1
    expect(stepBlocked(world, guard)).toBe(false)
  })

  it('a patrol walking into gas stops short of it', () => {
    const world = arena()
    putPlayer(world, 140)
    startLeak(world, { x: 50.5, y: GROUND - 1 }, 60)
    run(world, 8)
    const guard = patrol(world, 30, 60)
    let deepest = 0
    run(world, 20, {}, () => {
      deepest = Math.max(deepest, feetOf(guard).x)
    })
    expect(deepest).toBeLessThan(50)
  })

  it('a guard wading into a flood turns off the tap feeding it', () => {
    const world = arena()
    addSource(world, 'water', { x: 40.5, y: GROUND - 0.5 }, 3, 120, 'burst pipe')
    const guard = addGuard(world, 40, 1, 'patrol')
    wadeIntoFlood(world, guard)
    expect(world.systems.sources.length).toBe(1)
    pourLiquid(world, 'water', 40, GROUND - 1, 0.6)
    wadeIntoFlood(world, guard)
    expect(world.systems.sources.length).toBe(0)
  })
})
