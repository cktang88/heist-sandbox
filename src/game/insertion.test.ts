import { describe, expect, it } from 'vitest'
import { idleInput } from './input'
import { chooseDrop, dropPointAt } from './insertion'
import { boxHitsSolid } from './physics'
import { createPlayer, movePlayer } from './player'
import { blocksLaneAt, createGrid, fillTiles, setLaneFlags, CLEAR_OF_LANE } from './tiles'
import { createWorld, type SiteKind } from './world'

describe('planned parachute entry', () => {
  it.each([['outpost', 1], ['outpost', 2], ['complex', 1], ['complex', 2]] as [SiteKind, number][])('seed %s/%i can land at the chosen edge and central surfaces', (kind, seed) => {
    const world = createWorld(seed, kind)
    for (const x of [2, world.grid.width / 2, world.grid.width - 3]) {
      world.player = createPlayer({ x: 5, y: 1 })
      chooseDrop(world, x)
      const target = world.dropPoint!
      expect(boxHitsSolid(world.grid, world.player)).toBe(false)
      expect(world.player.x + world.player.w / 2).toBe(target.x)
      expect(blocksLaneAt(world.grid, target.x, target.y)).toBe(true)
      const input = { ...idleInput(), jumpHeld: true }
      for (let frame = 0; frame < 4000 && !world.player.onGround; frame += 1) movePlayer(world.grid, world.player, input, 1 / 60, world.stairwells)
      expect(world.player.onGround).toBe(true)
      expect(world.player.y + world.player.h).toBeCloseTo(target.y, 1)
      expect(world.player.hp).toBe(100)
      expect(world.clock).toBe(0)
    }
  })

  it('clamps the selection and ignores solids that stand outside the walking lane', () => {
    const world = createWorld(1)
    world.grid = createGrid(20, 40)
    world.groundY = 30
    fillTiles(world.grid, 0, 30, 19, 39, 'concrete')
    fillTiles(world.grid, 10, 10, 10, 10, 'steel')
    setLaneFlags(world.grid, 10, 10, CLEAR_OF_LANE)
    expect(dropPointAt(world, 10)).toEqual({ x: 10.5, y: 30 })
    expect(dropPointAt(world, -100).x).toBe(2.5)
    expect(dropPointAt(world, 1e6).x).toBe(17.5)
    expect(Number.isFinite(dropPointAt(world, NaN).x)).toBe(true)
  })
})
