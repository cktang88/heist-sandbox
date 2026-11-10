import type { Stairwell } from './site'
import { landingX } from './stairs'
import type { Vec } from './types'

/** The next thing to do to get from one spot to another: walk along this floor, or take a staircase. */
export type Hop =
  | { kind: 'walk'; x: number }
  | { kind: 'stairs'; well: Stairwell; stop: number; direction: 1 | -1 }
  | { kind: 'none' }

const SAME_FLOOR = 1.5
const AT_LANDING = 0.5

/**
 * Plans one step of a route between floors. Positions are feet positions.
 * Returns 'none' when no staircase serves this floor, so the caller can try something else (a ladder).
 */
export function nextHop(wells: readonly Stairwell[], from: Vec, goal: Vec): Hop {
  if (Math.abs(goal.y - from.y) < SAME_FLOOR) return { kind: 'walk', x: goal.x }
  const direction = goal.y < from.y ? 1 : -1
  let best: { well: Stairwell; stop: number; gap: number } | null = null
  for (const well of wells) {
    const stop = well.stops.findIndex((y) => Math.abs(y - from.y) < 0.5)
    if (stop < 0 || stop + direction < 0 || stop + direction >= well.stops.length) continue
    const gap = Math.abs(landingX(well, stop) - from.x)
    if (!best || gap < best.gap) best = { well, stop, gap }
  }
  if (!best) return { kind: 'none' }
  if (best.gap <= AT_LANDING) return { kind: 'stairs', well: best.well, stop: best.stop, direction }
  return { kind: 'walk', x: landingX(best.well, best.stop) }
}
