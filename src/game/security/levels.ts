import type { World } from '../world'

/**
 * What each site alert level means to the rest of the site. Other systems (the elevators) ask here rather
 * than comparing `world.security.level` with numbers of their own, so the two can never disagree.
 * This file imports nothing from the security AI, so anything may depend on it.
 */

/** From "intruder suspected" up, the control room recalls every elevator car to the street storey and holds it there. */
export const ELEVATOR_RECALL_LEVEL = 2
/** Lockdown: cars freeze wherever they are. */
export const LOCKDOWN_LEVEL = 4

export function isLockedDown(world: World): boolean {
  return world.security.level >= LOCKDOWN_LEVEL
}

/** Are elevator cars being held at the ground stop (the level below lockdown)? */
export function elevatorsRecalled(world: World): boolean {
  return world.security.level >= ELEVATOR_RECALL_LEVEL
}
