import { describe, expect, it } from 'vitest'
import { depthOffsetFor, FRONT_LANE } from './gaps/depth'
import { idleInput, type Input } from './input'
import { stepWorld } from './step'
import { setTile, tileAt } from './tiles'
import type { Body } from './types'
import { createWorld, type World } from './world'

const FRAME = 1 / 60

/** A tower office on the complex with nobody else around, and the player standing at its left end. */
function office(): { world: World; x0: number; x1: number; floorY: number } {
  const world = createWorld(1, 'complex')
  world.guards = []
  world.player.hp = 1e6
  const room = world.rooms.find((candidate) => candidate.building === 'tower' && candidate.storey === 8 && candidate.w >= 14 && candidate.kind !== 'stairwell')!
  // Rubble breaks up on furniture rather than burying it: clear the room so it can come to rest.
  for (const prop of world.props) prop.broken = true
  return { world, x0: room.x, x1: room.x + room.w - 1, floorY: room.floorY }
}

function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    world.player.hp = 1e6
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

function stand(body: Body, x: number, feetY: number): void {
  Object.assign(body, { x: x - body.w / 2, y: feetY - body.h - 0.01, vx: 0, vy: 0, onGround: true })
}

/** Drops `count` tiles of rubble one after another from row `fromY` onto column x, and lets each settle. */
function dropPile(world: World, x: number, fromY: number, count: number): void {
  for (let index = 0; index < count; index += 1) {
    world.falling.push({ x, y: fromY, vy: 0, kind: 'concrete' })
    run(world, 0.8)
    expect(world.falling).toEqual([])
  }
}

describe('fallen rubble', () => {
  it('a pile one or two tiles high is stepped round at floor level, drawn in front of it', () => {
    const { world, x0, floorY } = office()
    const pile = x0 + 6
    stand(world.player, x0 + 2, floorY)
    dropPile(world, pile, floorY - 5, 2)
    expect(tileAt(world.grid, pile, floorY - 2)).toBe('concrete')
    let inFront = false
    for (let frame = 0; frame < 60; frame += 1) {
      run(world, FRAME, { right: true })
      if (depthOffsetFor(world, world.player) > FRONT_LANE / 2) inFront = true
    }
    expect(world.player.x).toBeGreaterThan(pile + 1)
    expect(world.player.y + world.player.h).toBeCloseTo(floorY, 1)
    expect(inFront).toBe(true)
  })

  it('a pile three tiles high fills enough of the room to block it', () => {
    const { world, x0, floorY } = office()
    const pile = x0 + 6
    stand(world.player, x0 + 2, floorY)
    dropPile(world, pile, floorY - 5, 3)
    run(world, 1, { right: true })
    expect(world.player.x + world.player.w).toBeLessThan(pile + 0.01)
  })

  it('a heap growing up through a hole in the floor above breaks up there instead of plugging the hole', () => {
    const { world, x0, floorY } = office()
    stand(world.player, x0 + 2, floorY)
    const column = x0 + 8
    setTile(world.grid, column, floorY - 6, 'air')
    dropPile(world, column, floorY - 10, 8)
    expect(tileAt(world.grid, column, floorY - 6)).toBe('air')
    expect(tileAt(world.grid, column, floorY - 5)).toBe('concrete')
  })
})
