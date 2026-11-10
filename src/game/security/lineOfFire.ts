import { tileResistance } from '../ballistics/materials'
import { propSpec } from '../propCatalog'
import { tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { coverNear } from './coverSpots'

/**
 * Whether a bullet could get from one point to another, judged the way projectiles.ts flies one: every tile on the
 * line costs its resistance (ballistics/materials.ts) and the round stops when it cannot pay. Guards use it to decide
 * whether firing back through a hole, a window or a door is worth it, and whether a spot shelters them from the shooter.
 */

const STEP = 0.25
/** Penetration of the guards' own guns (as the player's pistol and rifle in guns.ts): a pistol gets through glass, a rifle through a door. */
export const GUARD_PISTOL = 2
export const GUARD_RIFLE = 5
/** A spot counts as sheltered when more than this stands between it and the shooter: more than glass, so a pane is no hiding place. */
const SHELTERING = 2
/** A shooter this close to a piece of furniture fires over it (as cover.ts does for shots). */
const OWN_COVER_REACH = 1.2
const LOW_COVER_TOP = 0.95

/** Total resistance on the straight line between two points, counting each tile once, stopping early past `enough`. */
export function resistanceBetween(world: World, from: Vec, to: Vec, enough: number): number {
  const gap = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.ceil(gap / STEP)
  let total = 0
  let lastX = Math.floor(from.x)
  let lastY = Math.floor(from.y)
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps
    const x = Math.floor(from.x + (to.x - from.x) * t)
    const y = Math.floor(from.y + (to.y - from.y) * t)
    if (x === lastX && y === lastY) continue
    lastX = x
    lastY = y
    total += tileResistance(tileAt(world.grid, x, y))
    if (total > enough) return total
  }
  return total
}

/** Could a round with this much penetration get from `from` to `to`? */
export function roundReaches(world: World, from: Vec, to: Vec, power: number): boolean {
  return resistanceBetween(world, from, to, power) <= power
}

/** Points on a body (feet position) that a shooter would aim at: head and chest standing, the top of the back kneeling. */
export function bodyPoints(feet: Vec, crouching: boolean): Vec[] {
  return crouching ? [{ x: feet.x, y: feet.y - 0.7 }] : [{ x: feet.x, y: feet.y - 1.35 }, { x: feet.x, y: feet.y - 0.9 }]
}

/** Is a body at these feet open to rounds from `threat`, or does a wall, slab, door or piece of cover take them? */
export function exposedTo(world: World, threat: Vec, feet: Vec, crouching: boolean): boolean {
  return bodyPoints(feet, crouching).some((point) => resistanceBetween(world, threat, point, SHELTERING) <= SHELTERING && !furnitureBetween(world, threat, point, feet))
}

/** Floor furniture on the target's floor that stands between the shooter and that point, unless the shooter is right at it. */
function furnitureBetween(world: World, threat: Vec, point: Vec, feet: Vec): boolean {
  for (const entry of coverNear(world, feet.x, feet.y, 3)) {
    // Low cover hides only a kneeling body, whatever the model's height; high cover hides a standing one.
    const height = propSpec(entry.prop.kind).h
    const top = feet.y - (entry.high ? Math.max(LOW_COVER_TOP + 0.6, height) : Math.min(height, LOW_COVER_TOP))
    const shooterAtIt = threat.x >= entry.left - OWN_COVER_REACH && threat.x <= entry.right + OWN_COVER_REACH && Math.abs(threat.y - feet.y) < 2
    if (!shooterAtIt && segmentCrossesBox(threat, point, entry.left, entry.right, top, feet.y)) return true
  }
  return false
}

function segmentCrossesBox(a: Vec, b: Vec, left: number, right: number, top: number, bottom: number): boolean {
  let enter = 0
  let leave = 1
  for (const [start, delta, low, high] of [[a.x, b.x - a.x, left, right], [a.y, b.y - a.y, top, bottom]] as const) {
    if (Math.abs(delta) < 1e-9) {
      if (start < low || start > high) return false
      continue
    }
    const t0 = (low - start) / delta
    const t1 = (high - start) / delta
    enter = Math.max(enter, Math.min(t0, t1))
    leave = Math.min(leave, Math.max(t0, t1))
    if (enter > leave) return false
  }
  return true
}
