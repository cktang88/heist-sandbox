import { describe, expect, it } from 'vitest'
import { throwFrag } from '../frag/frag'
import { boxHitsSolid } from '../physics'
import { stairPoint } from '../stairs'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { enterCombat } from './combat'
import type { Guard } from './model'
import { addGuard, addUpperFloor, arena, GROUND, putPlayer, run } from './testArena'

/** Whatever happens to him (a dive off the stairs, a landing full of rubble), a guard never ends up inside solid tiles. */

/** Two floors and a staircase from x 34 (ground) up to x 38 on the upper floor, whose flight passes the slab. */
function stairs(): World {
  const world = arena()
  const upper = addUpperFloor(world, 0, 120)
  world.stairwells.push({ id: 0, building: 'site', leftX: 34, rightX: 38, stops: [GROUND, upper] })
  putPlayer(world, 100)
  return world
}

function onFlight(world: World, guard: Guard, u: number): void {
  const feet = stairPoint(world.stairwells[0], u)
  Object.assign(guard, { x: feet.x - guard.w / 2, y: feet.y - guard.h, vx: 0, vy: 0, stairs: { well: 0, u } })
}

function everInsideSolid(world: World, guard: Guard, seconds: number): boolean {
  let inside = false
  run(world, seconds, {}, () => {
    if (!guard.stairs && boxHitsSolid(world.grid, guard)) inside = true
  })
  return inside
}

describe('never inside solid tiles', () => {
  it('a guard diving away from a frag halfway up a flight that crosses the slab', () => {
    const world = stairs()
    const guard = addGuard(world, 36, 1, 'patrol')
    onFlight(world, guard, 0.85)
    expect(boxHitsSolid(world.grid, guard)).toBe(true)
    throwFrag(world, { x: guard.x + 1.2, y: guard.y + 1 }, { x: 0, y: 1 })
    expect(everInsideSolid(world, guard, 3)).toBe(false)
  })

  it('a guard arriving at a landing filled with rubble', () => {
    const world = stairs()
    fillTiles(world.grid, 37, GROUND - 9, 39, GROUND - 7, 'concrete')
    const guard = addGuard(world, 34, 1, 'patrol')
    guard.hp = guard.maxHp = 1e5
    onFlight(world, guard, 0.6)
    enterCombat(world, guard, { x: 60, y: GROUND - 7 })
    expect(everInsideSolid(world, guard, 4)).toBe(false)
  })
})
