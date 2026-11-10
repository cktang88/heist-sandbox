import { describe, expect, it } from 'vitest'
import { siteFor } from './complex/audit'
import { createHoles } from './gaps/holes'
import { nextHop } from './nav'
import { createRng, randomInt } from './rng'
import type { Level, Room } from './site'
import { landingX } from './stairs'
import { isSolidAt, tileAt } from './tiles'
import type { Vec } from './types'

/**
 * Could a body walk along floor `y` from `a` to `b`: floor all the way (or the top of a ladder, a hatch or a shaft
 * lane, which people walk past on the back of the slab), and nothing but doors in the way?
 */
function canWalk(level: Level, y: number, a: number, b: number): boolean {
  const built = builtOpenings(level)
  const step = a < b ? 1 : -1
  for (let x = Math.floor(a); x !== Math.floor(b); x += step) {
    const next = x + step
    const passable = isSolidAt(level.grid, next, y) || tileAt(level.grid, next, y) === 'ladder' || built[y * level.grid.width + next] !== 0
    if (!passable) return false
    for (const row of [y - 1, y - 2]) if (isSolidAt(level.grid, next, row) && tileAt(level.grid, next, row) !== 'door') return false
  }
  return true
}

const openings = new WeakMap<Level, Uint8Array>()

/** The slab map's built openings for a level, worked out once. */
function builtOpenings(level: Level): Uint8Array {
  let built = openings.get(level)
  if (!built) {
    built = createHoles(level).built
    openings.set(level, built)
  }
  return built
}

/** Follows the planner hop by hop like a guard would. Returns where it went wrong, or 'arrived'. */
function follow(level: Level, start: Vec, goal: Vec): string {
  let at = start
  for (let hops = 0; hops < 120; hops += 1) {
    const hop = nextHop(level.stairwells, at, goal)
    if (hop.kind === 'none') return `no way on from ${at.x},${at.y}`
    if (hop.kind === 'stairs') {
      const next = hop.stop + hop.direction
      at = { x: landingX(hop.well, next), y: hop.well.stops[next] }
      continue
    }
    if (!canWalk(level, at.y, at.x, hop.x)) return `blocked walking ${at.x}->${hop.x} on ${at.y}`
    at = { x: hop.x, y: at.y }
    if (Math.abs(at.y - goal.y) < 1.5 && Math.abs(at.x - goal.x) < 0.5) return 'arrived'
  }
  return 'went round in circles'
}

const middle = (room: Room): Vec => ({ x: room.x + room.w / 2, y: room.floorY })

describe('route planning across the complex', () => {
  // The gatehouse is left out: a steel gate fills the street between it and the rest of the site at body height
  // (x 50 on seed 1, 249 on seed 4), so nobody walks there (reported for the owner to decide).
  const indoor = (level: Level) => level.rooms.filter((room) => room.building !== 'gatehouse'
    && !['rooftop', 'vault', 'street', 'yard', 'sewer', 'silo'].includes(room.kind))

  it.each([1, 2, 3, 4])('seed %i gets a guard from any room to any other on foot, between buildings too', (seed) => {
    const level = siteFor(seed, 'complex')
    const rooms = indoor(level)
    const rng = createRng(seed)
    const failures: string[] = []
    for (let sample = 0; sample < 150; sample += 1) {
      const [a, b] = [rooms[randomInt(rng, 0, rooms.length - 1)], rooms[randomInt(rng, 0, rooms.length - 1)]]
      const result = follow(level, middle(a), middle(b))
      if (result !== 'arrived') failures.push(`${a.building}:${a.storey} ${a.kind} -> ${b.building}:${b.storey} ${b.kind}: ${result}`)
    }
    expect(failures).toEqual([])
  })

  it('plans the same hop every time, quickly', () => {
    const level = siteFor(3, 'complex')
    const rooms = indoor(level)
    const rng = createRng(11)
    const pairs = Array.from({ length: 500 }, () => [middle(rooms[randomInt(rng, 0, rooms.length - 1)]), middle(rooms[randomInt(rng, 0, rooms.length - 1)])])
    const first = pairs.map(([from, goal]) => nextHop(level.stairwells, from, goal))
    const started = performance.now()
    const again = pairs.map(([from, goal]) => nextHop(level.stairwells, from, goal))
    const seconds = (performance.now() - started) / 1000
    expect(again).toEqual(first)
    // A guard plans a hop every frame; seventy of them must not eat the frame (about 10 µs each when idle).
    expect(seconds / pairs.length).toBeLessThan(0.0001)
  })
})
