import { boxHitsSolid } from '../physics'
import { isSolidAt } from '../tiles'
import type { Body } from '../types'
import type { World } from '../world'
import { isWalkableHole, type Holes } from './holes'
import { currentHoles } from './state'

/**
 * Carrying people across walk-past holes. Done as a correction after everyone has moved, like standing on
 * furniture tops (see physprops/stand.ts): a person who has just sunk into a walk-past hole from the floor
 * beside it, and does not want to drop, is put back on the floor's level, standing on the back of the slab.
 * Only living people choosing where to walk are carried; everything else falls through as before.
 */

const EPSILON = 0.001
/** Feet may sink this far into the hole in one frame and still be put back (a fall of a full tile is not a step). */
const MAX_SINK = 0.9
/**
 * Someone who last stood at most this far above the slab (on a table, or jumping from the same floor) lands on it.
 * Someone falling from the storey above, six rows up, keeps falling: a predictable rule that does not hang on speed.
 */
const CATCH_FROM_ABOVE = 3.5
/** Feet this close to the slab's row count as having stood on that floor. */
const SAME_FLOOR = 0.5

/** True when a person at feet x on slab row `floorY` would walk past (not fall into) the hole there. */
export function canWalkAcross(world: World, x: number, floorY: number): boolean {
  return isWalkableHole(currentHoles(world), x, floorY)
}

/** True when the slab row under the body is floor or walk-past hole all the way across it, with at least one hole. */
export function heldUpByHoles(holes: Holes, body: Body, floorY: number): boolean {
  let overHole = false
  for (let column = Math.floor(body.x); column <= Math.floor(body.x + body.w - EPSILON); column += 1) {
    if (isWalkableHole(holes, column, floorY)) overHole = true
    else if (!isSolidAt(holes.grid, column, floorY)) return false
  }
  return overHole
}

/**
 * Puts a person who has just sunk into a walk-past hole back on the floor's level. Returns true if it did.
 * `wantsToDrop` is the person's choice to go down through the hole instead.
 */
export function carryAcross(world: World, body: Body, wantsToDrop: boolean): boolean {
  if (wantsToDrop || body.vy < 0) return false
  const feet = body.y + body.h
  const row = Math.floor(feet)
  if (feet - row > MAX_SINK) return false
  const stood = world.gaps.stoodAt.get(body)
  if (stood === undefined || stood > row + SAME_FLOOR || stood < row - CATCH_FROM_ABOVE) return false
  const holes = currentHoles(world)
  if (!heldUpByHoles(holes, body, row)) return false
  const y = row - body.h - EPSILON
  if (boxHitsSolid(world.grid, { ...body, y })) return false
  body.y = y
  body.vy = 0
  body.onGround = true
  return true
}

/** Notes the floor a person is standing on, for `carryAcross`. */
export function rememberFooting(world: World, body: Body): void {
  if (body.onGround) world.gaps.stoodAt.set(body, body.y + body.h)
}
