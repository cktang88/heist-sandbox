import type { Stairwell } from './site'
import { landingX } from './stairs'
import type { Vec } from './types'

/** The next thing to do to get from one spot to another: walk along this floor, take a staircase, or drop through a hole in the floor. */
export type Hop =
  | { kind: 'walk'; x: number }
  | { kind: 'stairs'; well: Stairwell; stop: number; direction: 1 | -1 }
  | { kind: 'drop'; x: number }
  | { kind: 'none' }

/** The column of the hole in slab row `floorY` nearest x that someone may drop through, or null. Holes are a way down only. */
export type HoleFinder = (floorY: number, x: number) => number | null

const SAME_FLOOR = 1.5
const AT_LANDING = 0.5

/**
 * Plans one step of a route between floors. Positions are feet positions.
 * With `holes`, a hole in the floor is a way down too, taken when walking to it, dropping and walking on is shorter
 * than going by the stairs.
 * Returns 'none' when no staircase (or hole) serves this floor, so the caller can try something else (a ladder).
 */
export function nextHop(wells: readonly Stairwell[], from: Vec, goal: Vec, holes?: HoleFinder): Hop {
  if (Math.abs(goal.y - from.y) < SAME_FLOOR) return { kind: 'walk', x: goal.x }
  const direction = goal.y < from.y ? 1 : -1
  let best: { well: Stairwell; stop: number; gap: number } | null = null
  for (const well of wells) {
    const stop = well.stops.findIndex((y) => Math.abs(y - from.y) < 0.5)
    if (stop < 0 || stop + direction < 0 || stop + direction >= well.stops.length) continue
    const gap = Math.abs(landingX(well, stop) - from.x)
    if (!best || gap < best.gap) best = { well, stop, gap }
  }
  const drop = direction < 0 && holes ? holeDrop(holes, from, goal, best) : null
  if (drop) return drop
  if (!best) return { kind: 'none' }
  if (best.gap <= AT_LANDING) return { kind: 'stairs', well: best.well, stop: best.stop, direction }
  return { kind: 'walk', x: landingX(best.well, best.stop) }
}

/** The way down through the nearest hole, when that beats the best staircase (to the landing, down the flight, on to the goal). */
function holeDrop(holes: HoleFinder, from: Vec, goal: Vec, stairs: { well: Stairwell; stop: number; gap: number } | null): Hop | null {
  const column = holes(Math.round(from.y), from.x)
  if (column === null) return null
  const x = column + 0.5
  const byHole = Math.abs(x - from.x) + Math.abs(goal.x - x)
  if (!stairs) return { kind: 'drop', x }
  const below = landingX(stairs.well, stairs.stop - 1)
  const flight = Math.hypot(below - landingX(stairs.well, stairs.stop), stairs.well.stops[stairs.stop - 1] - stairs.well.stops[stairs.stop])
  const byStairs = stairs.gap + flight + Math.abs(goal.x - below)
  return byHole < byStairs ? { kind: 'drop', x } : null
}
