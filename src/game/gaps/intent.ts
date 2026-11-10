import type { Guard, GuardMode } from '../security/model'
import type { Vec } from '../types'

/** A goal more than this far below the slab is on a lower storey. */
const BELOW = 1.5
/** Guards in these moods take the quick way down; calm ones never step off a ledge, so they walk round. */
const HURRIED: ReadonlySet<GuardMode> = new Set(['combat', 'investigating', 'searching', 'toAlarm', 'panic'])

/** Whether someone heading for `goal` (a feet position) chooses to drop through a hole in slab row `floorY`. */
export function wantsToDrop(goal: Vec | null, floorY: number, hurried: boolean): boolean {
  return hurried && goal !== null && goal.y > floorY + BELOW
}

/** A guard drops through when he is in a hurry and where he is going (or looking) is on a storey below. */
export function guardWantsToDrop(guard: Guard, floorY: number): boolean {
  return wantsToDrop(guard.target ?? guard.interest?.at ?? null, floorY, HURRIED.has(guard.mode))
}
