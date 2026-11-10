import type { Body } from '../types'
import type { World } from '../world'
import { isWalkableHole } from './holes'
import { currentHoles } from './state'

/** Where the remaining back strip of a holed slab is, in depth: the same lane the staircases use. */
export const BACK_STRIP_LANE = -1.5
/** Feet this close to a slab row count as standing on it. */
const ON_FLOOR = 0.2
/** A person starts stepping back toward the strip this far (beyond their own half width) before reaching the hole. */
const STEP_ASIDE = 0.6
const SEARCH = 2

/**
 * The z a person should be drawn at: on the back strip while crossing a walk-past hole, easing back to the
 * walking lane (0) as they step off it. Reads what the last step worked out, so drawing changes nothing.
 */
export function depthOffsetFor(world: World, body: Body): number {
  const holes = world.gaps.holes
  if (holes.walkable.size === 0 || holes.grid !== world.grid) return 0
  const feet = body.y + body.h
  const row = Math.round(feet)
  if (Math.abs(feet - row) > ON_FLOOR) return 0
  const center = body.x + body.w / 2
  let nearest = Number.POSITIVE_INFINITY
  for (let column = Math.floor(center) - SEARCH; column <= Math.floor(center) + SEARCH; column += 1) {
    if (!isWalkableHole(holes, column, row)) continue
    nearest = Math.min(nearest, Math.max(0, column - center, center - (column + 1)))
  }
  const share = 1 - (nearest - body.w / 2) / STEP_ASIDE
  return BACK_STRIP_LANE * Math.max(0, Math.min(1, share))
}

/**
 * Column of the nearest walk-past hole on slab row `floorY` within `reach` tiles of x, or null.
 * For route planning: a hole is a way down (drop) and, with a ledge grab, a way up.
 */
export function nearestHole(world: World, floorY: number, x: number, reach: number): number | null {
  const holes = currentHoles(world)
  if (holes.walkable.size === 0) return null
  const start = Math.floor(x)
  for (let distance = 0; distance <= reach; distance += 1) {
    if (isWalkableHole(holes, start - distance, floorY)) return start - distance
    if (isWalkableHole(holes, start + distance, floorY)) return start + distance
  }
  return null
}
