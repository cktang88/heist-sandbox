import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from './input'
import { GROUND } from './level'
import { stepWorld } from './step'
import { fillTiles, tileAt } from './tiles'
import { toolIndex } from './toolDefs'
import type { Vec } from './types'
import { createWorld, type World } from './world'

/** Scripted play with C4: put it on walls, doors and ceilings, throw it, and set it off. */

const FRAME = 1 / 60

function play(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
  }
}

/** An outpost with no guards, C4 in hand, the player's feet at `x` on the ground floor or street. */
function standAt(x: number): World {
  const world = createWorld(1)
  world.guards = []
  Object.assign(world.player, { x: x - 0.35, y: GROUND - 1.61, vx: 0, vy: 0, hp: 1e6, tool: toolIndex('c4') })
  play(world, 0.2)
  return world
}

function useAt(world: World, aim: Vec): void {
  play(world, FRAME, { fire: true, firePressed: true, aim })
}

const center = (world: World) => ({ x: world.charges[0].x + 0.2, y: world.charges[0].y + 0.2 })

describe('C4', () => {
  it('sticks to a wall at head height and stays there', () => {
    const world = standAt(38.5)
    fillTiles(world.grid, 40, GROUND - 4, 40, GROUND - 1, 'brick')
    useAt(world, { x: 40.2, y: GROUND - 1.3 })
    expect(world.charges[0].stuck).toEqual({ x: 40, y: GROUND - 2 })
    const at = center(world)
    expect(at.x).toBeCloseTo(39.8, 1)
    play(world, 2)
    expect(center(world)).toEqual(at)
  })

  it('comes loose and falls when the wall it is stuck to is destroyed', () => {
    const world = standAt(38.5)
    fillTiles(world.grid, 40, GROUND - 4, 40, GROUND - 1, 'brick')
    useAt(world, { x: 40.2, y: GROUND - 1.3 })
    fillTiles(world.grid, 40, GROUND - 4, 40, GROUND - 1, 'air')
    play(world, 1)
    const charge = world.charges[0]
    expect(charge.y + charge.h).toBeCloseTo(GROUND, 1)
    expect(charge.stuck).toEqual({ x: Math.floor(charge.x + 0.2), y: GROUND })
  })

  it('sticks to a door, and Q blows the door away', () => {
    const world = standAt(69)
    expect(tileAt(world.grid, 70, GROUND - 2)).toBe('door')
    useAt(world, { x: 70.1, y: GROUND - 1.8 })
    expect(world.charges[0].stuck).toEqual({ x: 70, y: GROUND - 2 })
    world.player.hp = 1e6
    Object.assign(world.player, { x: 60 })
    play(world, FRAME, { detonatePressed: true })
    play(world, 0.5)
    expect(world.charges).toHaveLength(0)
    expect(tileAt(world.grid, 70, GROUND - 2)).toBe('air')
  })

  it('sticks to a ceiling overhead', () => {
    const world = standAt(40.5)
    fillTiles(world.grid, 36, GROUND - 4, 44, GROUND - 4, 'concrete')
    useAt(world, { x: 40.6, y: GROUND - 2.7 })
    expect(world.charges[0].stuck).toEqual({ x: 40, y: GROUND - 4 })
    expect(world.charges[0].face).toEqual({ x: 0, y: 1 })
    const at = center(world)
    play(world, 2)
    expect(center(world)).toEqual(at)
  })

  it('is pressed onto the back wall of a room when aimed at open air close by indoors', () => {
    const world = standAt(85.5)
    const aim = { x: 86.5, y: GROUND - 2.5 }
    expect(tileAt(world.grid, 86, GROUND - 3)).toBe('air')
    useAt(world, aim)
    expect(world.charges[0].stuck).toBe('backWall')
    play(world, 2)
    expect(center(world)).toEqual(aim)
  })

  it('is thrown outdoors, or when aimed far away, and sticks where it lands', () => {
    const world = standAt(30)
    useAt(world, { x: 31, y: GROUND - 3 })
    expect(world.charges[0].stuck).toBeNull()
    useAt(world, { x: 45, y: GROUND - 3 })
    play(world, 3)
    for (const charge of world.charges) {
      expect(charge.stuck).not.toBeNull()
      expect(charge.y + charge.h).toBeCloseTo(GROUND, 1)
    }
    const far = world.charges.reduce((best, charge) => (charge.x > best.x ? charge : best))
    expect(far.x).toBeGreaterThan(33)
  })
})
