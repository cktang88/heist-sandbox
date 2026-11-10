import { describe, expect, it } from 'vitest'
import { fillTiles, setTile, tileAt } from '../tiles'
import type { World } from '../world'
import { feetOf, setMode } from './model'
import { addGuard, arena, GROUND, run } from './testArena'

/** Manholes and floor hatches: a ladder down a shaft under a cover in the floor that guards open like any door. */

const SHAFT = 40
const BELOW = GROUND + 9

/** A tunnel under the arena floor (x 20-80, floor row 39) reached by a ladder at x 40 under a closed hatch. */
function manhole(): World {
  const world = arena()
  fillTiles(world.grid, 20, GROUND + 1, 80, BELOW - 1, 'air')
  fillTiles(world.grid, SHAFT, GROUND + 1, SHAFT, BELOW - 1, 'ladder')
  setTile(world.grid, SHAFT, GROUND, 'door')
  return world
}

function sendTo(world: World, x: number, feetY: number, goal: { x: number; y: number }) {
  const guard = addGuard(world, x, 1, 'patrol', feetY)
  setMode(guard, 'investigating')
  guard.interest = { at: goal, kind: 'noise', priority: 4, reached: false }
  guard.target = goal
  return guard
}

describe('guards and floor hatches', () => {
  it('a guard with somewhere to be below opens the hatch and climbs down', () => {
    const world = manhole()
    const guard = sendTo(world, 30, GROUND, { x: 60, y: BELOW })
    run(world, 15, {}, () => Math.abs(feetOf(guard).y - BELOW) < 0.3)
    expect(tileAt(world.grid, SHAFT, GROUND)).not.toBe('door')
    expect(Math.abs(feetOf(guard).y - BELOW)).toBeLessThan(0.3)
  })

  it('a guard below climbs up and pushes the hatch open', () => {
    const world = manhole()
    const guard = sendTo(world, 55, BELOW, { x: 70, y: GROUND })
    run(world, 15, {}, () => Math.abs(feetOf(guard).y - GROUND) < 0.3)
    expect(tileAt(world.grid, SHAFT, GROUND)).not.toBe('door')
    expect(Math.abs(feetOf(guard).y - GROUND)).toBeLessThan(0.3)
  })

  it('a patrol walks past an open manhole: it is not a ledge, and he does not fall in', () => {
    const world = manhole()
    // Opened after the site was built, as the player would.
    run(world, 0.1)
    setTile(world.grid, SHAFT, GROUND, 'air')
    const guard = addGuard(world, 30, 1, 'patrol')
    guard.route = [{ x: 30, y: GROUND }, { x: 52, y: GROUND }]
    guard.routeIndex = 1
    let lowest = 0
    let furthest = 0
    run(world, 16, {}, () => {
      lowest = Math.max(lowest, feetOf(guard).y)
      furthest = Math.max(furthest, feetOf(guard).x)
    })
    expect(lowest).toBeLessThan(GROUND + 0.5)
    expect(furthest).toBeGreaterThan(50)
  })
})
