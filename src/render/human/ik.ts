import type { Vec } from '../../game/types'

/**
 * Finds the middle joint (knee or elbow) of a two-bone limb reaching from `root` to `target`.
 * `bend` is +1 or -1 and picks which way the joint pokes out.
 */
export function solveJoint(root: Vec, target: Vec, upper: number, lower: number, bend: number): Vec {
  const gap = Math.hypot(target.x - root.x, target.y - root.y)
  const reach = Math.max(Math.abs(upper - lower) + 0.001, Math.min(upper + lower - 0.001, gap))
  const toTarget = Math.atan2(target.y - root.y, target.x - root.x)
  const corner = Math.acos(Math.max(-1, Math.min(1, (upper * upper + reach * reach - lower * lower) / (2 * upper * reach))))
  return { x: root.x + Math.cos(toTarget + bend * corner) * upper, y: root.y + Math.sin(toTarget + bend * corner) * upper }
}

/**
 * Pulls `target` back toward `root` so it is no further than `limit` away.
 * Limbs are aimed at the clamped point so a hand or foot never ends up beyond what the bones can reach.
 */
export function reachToward(root: Vec, target: Vec, limit: number): Vec {
  const dx = target.x - root.x
  const dy = target.y - root.y
  const gap = Math.hypot(dx, dy)
  if (gap <= limit || gap === 0) return target
  return { x: root.x + (dx / gap) * limit, y: root.y + (dy / gap) * limit }
}
