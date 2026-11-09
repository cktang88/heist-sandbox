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
