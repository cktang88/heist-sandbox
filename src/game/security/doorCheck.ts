import { closeDoor } from '../doors/doors'
import type { World } from '../world'
import { barkLine } from './barks'
import type { Guard, Interest } from './model'

/**
 * A door found standing open that should be shut, opened by hand rather than forced. On its own that is someone's
 * carelessness: the guard shuts it, has a brief look round and carries on. Only a second one in the same night makes
 * him radio it in (site level 1, "stay sharp"). A forced door is a different matter (discoveries.ts).
 */

/** His look round at a door he shut, shorter than at real trouble. */
const BRIEF_LOOK = 2.5

/** At the door: shut it if nobody stands in it, count it, and return how long he looks round. */
export function shutFoundDoor(world: World, guard: Guard, interest: Interest): number {
  world.security.openDoorsFound += 1
  if (interest.door && closeDoor(world, interest.door)) barkLine(world, guard, 'doorShut')
  return BRIEF_LOOK
}

/** The first open door of the night is shrugged off; any after that is worth telling control about. */
export function openDoorWorthReporting(world: World): boolean {
  return world.security.openDoorsFound > 1
}
