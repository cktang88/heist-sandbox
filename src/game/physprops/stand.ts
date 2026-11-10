import { propBox } from '../hazards/props'
import { boxHitsSolid } from '../physics'
import type { Body } from '../types'
import type { World } from '../world'
import { isStandable } from './kinds'
import { looseProps } from './state'

/**
 * The tops of furniture the player has disturbed (dragged, tipped, knocked) are one-way platforms: jumping up
 * passes through them, coming down lands on them, and holding down drops through. So a table dragged under a hole
 * blown in the ceiling is a step up, and from its top the existing ledge grab reaches the edge of the hole.
 * Untouched furniture stays out of the way, as it always has, so walking and falling through rooms is unchanged.
 */

/** The body must overlap a top by this much to stand on it, so a toe on the corner does not count. */
const FOOTHOLD = 0.15
/** Feet this close above or below a top count as on it. */
const TOLERANCE = 0.05

/** Row of the furniture top the body would land on, coming down from `lastFeet` to where it is now, or null. */
export function standingSurfaceUnder(world: World, body: Body, lastFeet: number): number | null {
  const feet = body.y + body.h
  let best: number | null = null
  for (const { prop, loose } of looseProps(world)) {
    if (loose.flying || !isStandable(prop.kind) || world.hazards.burningProps.has(prop.id)) continue
    const box = propBox(prop)
    if (body.x + body.w < box.x + FOOTHOLD || body.x > box.x + box.w - FOOTHOLD) continue
    if (lastFeet > box.y + TOLERANCE || feet < box.y - TOLERANCE) continue
    if (best === null || box.y < best) best = box.y
  }
  return best
}

/** Puts a player who came down onto a furniture top on it, standing. */
export function landOnFurniture(world: World, dropThrough: boolean): void {
  const player = world.player
  const last = world.physProps.last
  if (!last || dropThrough || player.vy < 0 || player.stairs || player.mantle || player.onLadder) return
  if (player.onGround && Math.abs(player.y + player.h - last.feet) < TOLERANCE) return
  const top = standingSurfaceUnder(world, player, last.feet)
  if (top === null) return
  const standing = { ...player, y: top - player.h }
  if (boxHitsSolid(world.grid, standing)) return
  player.y = standing.y
  player.vy = 0
  player.onGround = true
  player.chute = false
  player.airJumps = 1
}
