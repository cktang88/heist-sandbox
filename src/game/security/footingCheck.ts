import { canClose, closeDoor, doorCentre, openedDoors } from '../doors/doors'
import { dangerAt, hazardKindAt, safeFooting, shutValves } from '../systems/systems'
import { footingAt } from '../systems/footing'
import type { World } from '../world'
import { feetOf, type Guard } from './model'

/**
 * Guards and the chain-reaction hazards (systems/): a man walking never takes the next step onto live water, deep water,
 * fire, under a falling fitting or into gas; at gas ahead he shuts the door on it if there is one at hand; and wading
 * into a flood he turns off the taps feeding it. Only the next step is looked at, so it costs next to nothing.
 */

/** Anything at or above this (gas, a falling fitting, fire, current) is a step he will not take. */
const TOO_DANGEROUS = 0.6
const STEP = 0.8
const DOOR_REACH = 2.5
const VALVE_REACH = 6

/** Would his next step put him somewhere that hurts? Shuts a door on gas ahead while he is at it. */
export function stepBlocked(world: World, guard: Guard): boolean {
  const feet = feetOf(guard)
  // The point in the tile his feet would be in after one step.
  const ahead = { x: feet.x + guard.facing * STEP, y: feet.y - 0.05 }
  if (safeFooting(world, ahead) && dangerAt(world, ahead) < TOO_DANGEROUS) return false
  if (hazardKindAt(world, ahead) === 'gas') shutDoorAhead(world, guard)
  return true
}

/** Standing in a flood: the taps and burst pipes feeding it nearby are turned off. */
export function wadeIntoFlood(world: World, guard: Guard): void {
  const feet = feetOf(guard)
  const footing = footingAt(world, { x: feet.x, y: feet.y - 0.05 })
  if (footing === 'wading' || footing === 'deep') shutValves(world, feet, VALVE_REACH)
}

function shutDoorAhead(world: World, guard: Guard): void {
  const feet = feetOf(guard)
  for (const [key, door] of openedDoors(world)) {
    const at = doorCentre(door)
    const ahead = (at.x - feet.x) * guard.facing
    if (ahead < 0 || ahead > DOOR_REACH || Math.abs(at.y - (feet.y - 0.5)) > 1.5 || !canClose(world, door)) continue
    closeDoor(world, key)
    return
  }
}
