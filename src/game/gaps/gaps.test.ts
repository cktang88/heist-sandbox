import { describe, expect, it } from 'vitest'
import { createGuard } from '../guards'
import { idleInput, type Input } from '../input'
import { GROUND } from '../level'
import { GRAVITY, moveBody } from '../physics'
import { stepWorld } from '../step'
import { isSolidAt, setTile, tileAt } from '../tiles'
import type { Body } from '../types'
import { createWorld, type World } from '../world'
import { canWalkAcross, depthOffsetFor, nearestHole, stepGaps } from './gaps'

const FRAME = 1 / 60
const HOLE = 3

/** A world with nobody to shoot at the player, who is hard to kill. */
function quietWorld(kind: 'outpost' | 'complex', seed = 1): World {
  const world = createWorld(seed, kind)
  world.guards = []
  world.player.hp = 1e6
  return world
}

/**
 * A stretch of slab row `floorY` with open air above it (no ladders), `length` tiles long, away from walls, hatches and doors.
 * Returns its leftmost column.
 */
function clearStretch(world: World, floorY: number, length: number, from: number, to: number): number {
  for (let x = from; x + length <= to; x += 1) {
    let clear = true
    for (let column = x; column < x + length && clear; column += 1) {
      clear = isSolidAt(world.grid, column, floorY) && isSolidAt(world.grid, column, floorY + 6) && [1, 2, 3, 4, 5].every((up) => tileAt(world.grid, column, floorY - up) === 'air' && tileAt(world.grid, column, floorY + 6 - up) === 'air')
    }
    if (clear) return x
  }
  throw new Error(`no clear stretch on row ${floorY}`)
}

function blast(world: World, x: number, floorY: number, width = HOLE): void {
  for (let column = x; column < x + width; column += 1) setTile(world.grid, column, floorY, 'air')
}

function stand(body: Body, x: number, feetY: number): void {
  Object.assign(body, { x: x - body.w / 2, y: feetY - body.h - 0.01, vx: 0, vy: 0, onGround: true })
}

function run(world: World, seconds: number, input: (frame: number) => Partial<Input> = () => ({})): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    const player = world.player
    stepWorld(world, { ...idleInput({ x: player.x + 5, y: player.y }), ...input(frame) }, FRAME)
  }
}

const feetOf = (body: Body): number => body.y + body.h

/** Walks the player from the floor beside the hole to stand over its middle. */
function walkIntoMiddle(world: World, floorY: number, hole: number): void {
  stand(world.player, hole - 2, floorY)
  run(world, 0.1)
  run(world, 0.3, () => ({ right: true }))
  run(world, 0.6)
  expect(feetOf(world.player)).toBeCloseTo(floorY, 1)
}

/** The outpost's first upper floor, with a rocket hole in the middle of a clear stretch of it. */
function outpostHole(): { world: World; floorY: number; hole: number } {
  const world = quietWorld('outpost')
  const floorY = GROUND - 6
  const hole = clearStretch(world, floorY, HOLE + 10, 72, 117) + 5
  blast(world, hole, floorY)
  return { world, floorY, hole }
}

/** A tower office on the complex with a hole in its floor, and a clear stretch under it on the storey below. */
function complexHole(): { world: World; floorY: number; hole: number } {
  const world = quietWorld('complex')
  for (const room of world.rooms) {
    if (room.kind !== 'office' || room.w < 14 || room.floorY >= world.groundY - 12) continue
    try {
      const start = clearStretch(world, room.floorY, HOLE + 8, room.x + 1, room.x + room.w - 1)
      blast(world, start + 4, room.floorY, 2)
      return { world, floorY: room.floorY, hole: start + 4 }
    } catch {
      // This office has furniture walls or a shaft in the way; try the next.
    }
  }
  throw new Error('no office with a clear floor')
}

describe('walking past a hole in the floor', () => {
  for (const [name, site] of [['outpost', outpostHole], ['complex', complexHole]] as const) {
    it(`carries a runner across a rocket hole on the ${name}, on the floor's level`, () => {
      const { world, floorY, hole } = site()
      stand(world.player, hole - 2.5, floorY)
      run(world, 0.1)
      run(world, 0.8, () => ({ right: true }))
      expect(world.player.x).toBeGreaterThan(hole + HOLE)
      expect(feetOf(world.player)).toBeCloseTo(floorY, 1)
      expect(world.player.hp).toBe(1e6)
    })
  }

  it('lets the player stop in the middle and stand there, drawn on the back strip of the slab', () => {
    const { world, floorY, hole } = outpostHole()
    walkIntoMiddle(world, floorY, hole)
    expect(world.player.x + world.player.w / 2).toBeGreaterThan(hole)
    expect(world.player.x + world.player.w / 2).toBeLessThan(hole + HOLE)
    expect(feetOf(world.player)).toBeCloseTo(floorY, 1)
    expect(world.player.onGround).toBe(true)
    expect(depthOffsetFor(world, world.player)).toBeCloseTo(-1.5)
  })

  it('drops the player through when down is held over the hole', () => {
    const { world, floorY, hole } = outpostHole()
    walkIntoMiddle(world, floorY, hole)
    run(world, 1, () => ({ down: true }))
    expect(feetOf(world.player)).toBeCloseTo(floorY + 6, 1)
  })

  it('catches a jump from the same floor that comes down over the hole', () => {
    const { world, floorY, hole } = outpostHole()
    walkIntoMiddle(world, floorY, hole)
    run(world, 1, (frame) => ({ jumpPressed: frame === 0 }))
    expect(feetOf(world.player)).toBeCloseTo(floorY, 1)
  })

  it('lets a fall from the storey above carry on through', () => {
    const { world, floorY, hole } = outpostHole()
    blast(world, hole, floorY - 6)
    stand(world.player, hole + 1.5, floorY - 6)
    run(world, 0.1)
    run(world, 0.2, () => ({ down: true }))
    run(world, 1.5)
    expect(feetOf(world.player)).toBeCloseTo(floorY + 6, 1)
  })

  it('lets the player climb up through the hole from the storey below with the ledge grab', () => {
    const { world, floorY, hole } = outpostHole()
    stand(world.player, hole + 0.6, floorY + 6)
    run(world, 0.1)
    run(world, 1.5, (frame) => ({ jumpPressed: frame === 0 || frame === 20, right: frame > 26 }))
    run(world, 0.5)
    expect(feetOf(world.player)).toBeCloseTo(floorY, 1)
    expect(world.player.x).toBeGreaterThan(hole + HOLE - 0.3)
  })

  it('still lets a grenade rolled into the hole fall through', () => {
    const { world, floorY, hole } = outpostHole()
    stand(world.player, hole - 4, floorY)
    world.hazards.grenades.push({ x: hole + 1.3, y: floorY - 1, w: 0.3, h: 0.3, vx: 0, vy: 0, onGround: false, kind: 'smoke', fuse: 99, popped: false, smokeLeft: 0, cloud: [], thrower: 'player' })
    run(world, 1)
    expect(world.hazards.grenades[0].y).toBeGreaterThan(floorY + 4)
  })

  it('cannot be crossed once the hole takes most of the room', () => {
    const world = quietWorld('outpost')
    const floorY = GROUND - 6
    blast(world, 72, floorY, 30)
    expect(canWalkAcross(world, 90, floorY)).toBe(false)
    stand(world.player, 90, floorY)
    run(world, 0.8)
    expect(feetOf(world.player)).toBeCloseTo(floorY + 6, 1)
  })

  it('leaves built openings (ladder hatches) and outdoor ground as they are', () => {
    const world = quietWorld('outpost')
    const floorY = GROUND - 6
    let hatch = -1
    for (let x = 71; x < 118; x += 1) if (world.grid.kinds[floorY * world.grid.width + x] && !isSolidAt(world.grid, x, floorY)) hatch = x
    expect(hatch).toBeGreaterThan(0)
    blast(world, 20, GROUND, 2)
    run(world, FRAME)
    expect(canWalkAcross(world, hatch, floorY)).toBe(false)
    expect(canWalkAcross(world, 20, GROUND)).toBe(false)
    expect(world.gaps.holes.walkable.size).toBe(0)
  })

  it('is deterministic', () => {
    const trace = (): number[] => {
      const { world, floorY, hole } = outpostHole()
      stand(world.player, hole - 3, floorY)
      run(world, 2, (frame) => ({ right: frame < 40, down: frame > 30 && frame < 50, jumpPressed: frame === 60 }))
      return [world.player.x, world.player.y, world.player.vx, world.player.vy]
    }
    expect(trace()).toEqual(trace())
  })
})

describe('guards and floor holes', () => {
  /** Moves a guard as his walking code would (speed plus gravity through moveBody), then lets the gaps step correct him. */
  function walkGuard(world: World, guard: ReturnType<typeof createGuard>, speed: number, seconds: number): void {
    for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
      guard.vx = speed
      guard.vy += GRAVITY * FRAME
      moveBody(world.grid, guard, FRAME)
      stepGaps(world, idleInput({ x: 0, y: 0 }))
    }
  }

  it('walks across a hole by default', () => {
    const { world, floorY, hole } = outpostHole()
    const guard = createGuard({ x: hole - 3, y: floorY, facing: 1 })
    world.guards.push(guard)
    walkGuard(world, guard, 0, 0.1)
    walkGuard(world, guard, 3, 2.5)
    expect(guard.x).toBeGreaterThan(hole + HOLE)
    expect(feetOf(guard)).toBeCloseTo(floorY, 1)
  })

  it('drops through when chasing a player on the storey below', () => {
    const { world, floorY, hole } = outpostHole()
    const guard = createGuard({ x: hole - 1.5, y: floorY, facing: 1 })
    world.guards.push(guard)
    walkGuard(world, guard, 0, 0.1)
    guard.mode = 'combat'
    guard.target = { x: hole + 6, y: floorY + 6 }
    walkGuard(world, guard, 3, 2)
    expect(feetOf(guard)).toBeCloseTo(floorY + 6, 1)
  })

  it('a calm guard whose patrol point is below still walks round instead', () => {
    const { world, floorY, hole } = outpostHole()
    const guard = createGuard({ x: hole - 1.5, y: floorY, facing: 1 })
    world.guards.push(guard)
    guard.target = { x: hole + 6, y: floorY + 6 }
    walkGuard(world, guard, 0, 0.1)
    walkGuard(world, guard, 3, 1.5)
    expect(feetOf(guard)).toBeCloseTo(floorY, 1)
  })

  it('finds the nearest hole for route planning', () => {
    const { world, floorY, hole } = outpostHole()
    expect(nearestHole(world, floorY, hole - 4, 6)).toBe(hole)
    expect(nearestHole(world, floorY, hole - 10, 3)).toBeNull()
  })
})

describe('cost', () => {
  it('is next to nothing on the complex with no holes', () => {
    const world = quietWorld('complex')
    const input = idleInput({ x: 0, y: 0 })
    stepGaps(world, input)
    const started = performance.now()
    for (let frame = 0; frame < 1000; frame += 1) stepGaps(world, input)
    expect(performance.now() - started).toBeLessThan(20)
    expect(world.gaps.holes.walkable.size).toBe(0)
    expect(world.gaps.holes.slabs.length).toBeGreaterThan(1000)
  })
})
