import { CLEAR_OF_LANE, isSolidAt, type Grid } from '../tiles'
import type { Body } from '../types'
import type { World } from '../world'
import { anyWalkPast, builtAs, BUILT_SHAFT_LANE, isWalkableHole, type Holes } from './holes'
import { currentHoles } from './state'

/** Where the remaining back strip of a holed slab is, in depth: the same lane the staircases use. */
export const BACK_STRIP_LANE = -1.5
/**
 * Where people pass in front of something standing beside the walking lane (a low heap of rubble, a post, an elevator
 * shaft): just in front of the building's cut-open front face, at z = 0.5.
 */
export const FRONT_LANE = 0.85
/** Feet this close to a slab row count as standing on it. */
const ON_FLOOR = 0.2
/** A person starts stepping aside this far (beyond their own half width) before reaching what they pass. */
const STEP_ASIDE = 0.6
const SEARCH = 2

/**
 * The z a person should be drawn at: on the back strip while crossing a walk-past hole, in front while passing a
 * shaft, a heap of rubble or a post, easing back to the walking lane (0) as they step clear. Reads what the last step
 * worked out, so drawing changes nothing.
 */
export function depthOffsetFor(world: World, body: Body): number {
  const center = body.x + body.w / 2
  let back = 0
  let front = shareOf(body, nearestAside(world.grid, body, center))
  const holes = world.gaps.holes
  if (anyWalkPast(holes) && holes.grid === world.grid) {
    const feet = body.y + body.h
    const row = Math.round(feet)
    if (Math.abs(feet - row) <= ON_FLOOR) {
      back = shareOf(body, nearestHoleEdge(holes, row, center, false))
      front = Math.max(front, shareOf(body, nearestHoleEdge(holes, row, center, true)))
    }
  }
  return front > back ? FRONT_LANE * front : BACK_STRIP_LANE * back
}

/** How far into stepping aside a person is (0 on the lane, 1 fully aside), from the distance to what they pass. */
function shareOf(body: Body, distance: number): number {
  return Math.max(0, Math.min(1, 1 - (distance - body.w / 2) / STEP_ASIDE))
}

/** Distance from x to the nearest walk-past hole in row `row` (shaft lanes, or the rest), or infinity. */
function nearestHoleEdge(holes: Holes, row: number, center: number, shaftLane: boolean): number {
  let nearest = Number.POSITIVE_INFINITY
  for (let column = Math.floor(center) - SEARCH; column <= Math.floor(center) + SEARCH; column += 1) {
    if (!isWalkableHole(holes, column, row) || (builtAs(holes, column, row) === BUILT_SHAFT_LANE) !== shaftLane) continue
    nearest = Math.min(nearest, Math.max(0, column - center, center - (column + 1)))
  }
  return nearest
}

/** Distance from x to the nearest solid tile standing aside of the lane at the body's height, or infinity. */
function nearestAside(grid: Grid, body: Body, center: number): number {
  let nearest = Number.POSITIVE_INFINITY
  const bottom = Math.floor(body.y + body.h - 0.01)
  for (let row = Math.floor(body.y); row <= bottom; row += 1) {
    if (row < 0 || row >= grid.height) continue
    for (let column = Math.max(0, Math.floor(center) - SEARCH); column <= Math.min(grid.width - 1, Math.floor(center) + SEARCH); column += 1) {
      if ((grid.lane[row * grid.width + column] & CLEAR_OF_LANE) === 0 || !isSolidAt(grid, column, row)) continue
      nearest = Math.min(nearest, Math.max(0, column - center, center - (column + 1)))
    }
  }
  return nearest
}

/**
 * Column of the nearest walk-past hole on slab row `floorY` within `reach` tiles of x, or null.
 * For route planning: a hole is a way down (drop) and, with a ledge grab, a way up. An elevator shaft is neither.
 */
export function nearestHole(world: World, floorY: number, x: number, reach: number): number | null {
  const holes = currentHoles(world)
  if (!anyWalkPast(holes)) return null
  const usable = (column: number) => isWalkableHole(holes, column, floorY) && builtAs(holes, column, floorY) !== BUILT_SHAFT_LANE
  const start = Math.floor(x)
  for (let distance = 0; distance <= reach; distance += 1) {
    if (usable(start - distance)) return start - distance
    if (usable(start + distance)) return start + distance
  }
  return null
}
