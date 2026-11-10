import type { World } from '../world'
import { bodyAt } from '../stealth/bodies'
import { bark } from './barks'
import { startRadio } from './comms'
import type { Guard } from './model'
import { startSearch } from './orders'
import { floorBelow } from './places'

/**
 * A man knocked out comes round, either by himself (he climbs out of wherever he was stuffed and calls it in) or
 * because a colleague found him and shook him awake (who calls it in, at a lower pitch than a corpse would get).
 */

/** Stands him up where his body lay. */
function getUp(world: World, guard: Guard): void {
  const feet = floorBelow(world, bodyAt(guard))
  guard.out = false
  guard.stunSeconds = 0
  guard.ragdoll = null
  guard.hiddenIn = null
  Object.assign(guard, { x: feet.x - guard.w / 2, y: feet.y - guard.h, vx: 0, vy: 0, awareness: 0.6 })
  if (world.stealth.carried === world.guards.indexOf(guard)) world.stealth.carried = null
}

/** Woke up alone: he knows he was jumped, says so on the radio, and starts looking. */
export function comeRound(world: World, guard: Guard): void {
  getUp(world, guard)
  const index = world.guards.indexOf(guard)
  const at = { x: guard.x + guard.w / 2, y: guard.y + guard.h }
  bark(world, guard, 'Ugh... my head. Someone jumped me!', true)
  startSearch(world, guard, at)
  startRadio(world, guard, { kind: 'knockedOut', at, guard: index, by: null })
}

/** A colleague (`by`) shook him awake: he is groggy, the colleague radios it in. */
export function wakeColleague(world: World, guard: Guard, by: Guard): void {
  getUp(world, guard)
  const at = { x: guard.x + guard.w / 2, y: guard.y + guard.h }
  bark(world, guard, 'Someone choked me... came from behind.', true)
  startSearch(world, guard, at)
  startRadio(world, by, { kind: 'knockedOut', at, guard: world.guards.indexOf(guard), by: world.guards.indexOf(by) })
}
