import { describe, expect, it } from 'vitest'
import { propBox } from '../hazards/props'
import { addProp } from '../hazards/testWorld'
import { idleInput, type Input } from '../input'
import { stepWorld } from '../step'
import { setTile } from '../tiles'
import { createWorld, type World } from '../world'

/**
 * Furniture stands at the back of a room (z -2.2 to -0.6), on the strip of slab that a hole blasted in the front of a
 * floor leaves standing.
 */

const FRAME = 1 / 60

/** A tower office emptied of its furniture, the player out of the way at its left end. */
function office(): { world: World; x0: number; x1: number; floorY: number } {
  const world = createWorld(1, 'complex')
  world.guards = []
  for (const prop of world.props) prop.broken = true
  const room = world.rooms.find((candidate) => candidate.building === 'tower' && candidate.storey === 8 && candidate.w >= 14 && candidate.kind !== 'stairwell')!
  Object.assign(world.player, { x: room.x + 0.5, y: room.floorY - world.player.h - 0.01, vx: 0, vy: 0, hp: 1e6 })
  return { world, x0: room.x, x1: room.x + room.w - 1, floorY: room.floorY }
}

function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    world.player.hp = 1e6
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

describe('furniture over a hole in the front of the floor', () => {
  it('stays standing on the back strip, and falls once the whole floor under it is gone', () => {
    const { world, x0, x1, floorY } = office()
    const desk = addProp(world, 'desk', x0 + 7, floorY)
    run(world, 0.1)
    setTile(world.grid, x0 + 7, floorY, 'air')
    setTile(world.grid, x0 + 8, floorY, 'air')
    run(world, 1)
    expect(desk.y).toBe(floorY)
    for (let x = x0; x <= x1; x += 1) setTile(world.grid, x, floorY, 'air')
    run(world, 1.5)
    expect(desk.y).toBeGreaterThan(floorY + 3)
  })

  it('is dragged along the back strip across the hole', () => {
    const { world, x0, floorY } = office()
    const crate = addProp(world, 'crate', x0 + 4, floorY)
    Object.assign(world.player, { x: propBox(crate).x - world.player.w - 0.05 })
    run(world, 0.1)
    setTile(world.grid, x0 + 7, floorY, 'air')
    setTile(world.grid, x0 + 8, floorY, 'air')
    run(world, 2.5, { right: true, grab: true })
    expect(propBox(crate).x).toBeGreaterThan(x0 + 9)
    expect(crate.y).toBeCloseTo(floorY, 5)
  })

  it('drops through when pushed in with down held', () => {
    const { world, x0, floorY } = office()
    const crate = addProp(world, 'crate', x0 + 4, floorY)
    Object.assign(world.player, { x: propBox(crate).x - world.player.w - 0.05 })
    run(world, 0.1)
    setTile(world.grid, x0 + 7, floorY, 'air')
    setTile(world.grid, x0 + 8, floorY, 'air')
    run(world, 2.5, { right: true, grab: true, down: true })
    run(world, 1)
    expect(crate.y).toBeGreaterThan(floorY + 3)
  })
})
