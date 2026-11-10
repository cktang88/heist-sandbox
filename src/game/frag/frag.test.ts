import { describe, expect, it } from 'vitest'
import { addGuard, bareWorld } from '../hazards/testWorld'
import { idleInput } from '../input'
import { nextHop } from '../nav'
import type { Stairwell } from '../site'
import { fillTiles, isSolidAt } from '../tiles'
import { actionIndex } from '../toolDefs'
import { useTool } from '../tools'
import type { World } from '../world'
import { stepAftermath } from './aftermath'
import { FRAG_BLAST, stepFrags, type Frag } from './frag'

const FRAME = 1 / 60
const WELL: Stairwell = { id: 0, building: 'test', leftX: 10, rightX: 20, stops: [42, 36, 30, 24] }

/** A staircase of four stops with a slab under each landing, over a ground floor on row 42. */
function stairWorld(): World {
  const world = bareWorld(60, 44)
  fillTiles(world.grid, 16, 36, 24, 36, 'concrete')
  fillTiles(world.grid, 6, 30, 14, 30, 'concrete')
  fillTiles(world.grid, 16, 24, 24, 24, 'concrete')
  world.stairwells = [{ ...WELL, stops: [...WELL.stops] }]
  return world
}

function frag(x: number, feetY: number, vx: number): Frag {
  return { x: x - 0.15, y: feetY - 0.3, w: 0.3, h: 0.3, vx, vy: 0, onGround: true, fuse: 2.5, stairs: null }
}

function run(world: World, seconds: number): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepFrags(world, FRAME)
    stepAftermath(world)
  }
}

describe('frag grenades', () => {
  it('rolls off a landing and rattles down the staircase, landing after landing', () => {
    const world = stairWorld()
    const rolling = frag(10, 30, 2)
    rolling.fuse = 9
    world.frags.push(rolling)
    run(world, 0.2)
    expect(rolling.stairs).not.toBeNull()
    run(world, 2.5)
    expect(rolling.y + rolling.h).toBeGreaterThan(37)
  })

  it('stops at a landing when rolling away from the flight down', () => {
    const world = stairWorld()
    const rolling = frag(10, 30, -2)
    world.frags.push(rolling)
    run(world, 0.5)
    expect(rolling.stairs).toBeNull()
    expect(rolling.y + rolling.h).toBeCloseTo(30, 1)
  })

  it('goes straight down the stairs when lobbed downward from them', () => {
    const world = stairWorld()
    const player = world.player
    player.stairs = { well: 0, u: 2.5 }
    Object.assign(player, { x: 15 - player.w / 2, y: 27 - player.h })
    player.tool = actionIndex('frag')
    useTool(world, { ...idleInput({ x: player.x - 3, y: player.y + 6 }), firePressed: true }, FRAME)
    expect(world.frags).toHaveLength(1)
    expect(world.frags[0].stairs).toEqual({ well: 0, u: 2.5 })
  })

  it('explodes when its fuse runs out, killing people close by and blowing away the flight it lies on', () => {
    const world = stairWorld()
    const guard = addGuard(world, 16, 36, 1)
    const sitting = frag(17, 36, 0)
    sitting.fuse = 0.5
    world.frags.push(sitting)
    run(world, 0.4)
    expect(guard.hp).toBeGreaterThan(0)
    run(world, 0.2)
    expect(world.frags).toHaveLength(0)
    expect(guard.hp).toBeLessThanOrEqual(0)
    expect(world.sounds.some((sound) => sound.kind === 'explosion')).toBe(true)
    // The flights either side of the landing are gone: nobody can climb from the ground to the top any more.
    expect(nextHop(world.stairwells, { x: 10, y: 42 }, { x: 20, y: 24 }).kind).toBe('none')
  })

  it('shreds glass but leaves the concrete it lies on', () => {
    const world = stairWorld()
    fillTiles(world.grid, 26, 33, 26, 35, 'glass')
    const sitting = frag(24, 36, 0)
    sitting.fuse = 0.1
    world.frags.push(sitting)
    run(world, 0.2)
    expect(isSolidAt(world.grid, 24, 36)).toBe(true)
    expect(isSolidAt(world.grid, 26, 34)).toBe(false)
    expect(FRAG_BLAST.radius).toBeGreaterThan(2)
  })
})
