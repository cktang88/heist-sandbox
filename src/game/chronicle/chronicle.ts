import type { World } from '../world'
import { watchBlasts, watchWreckage } from './watchDestruction'
import { watchEntry } from './watchEntry'
import { watchGuards } from './watchGuards'
import { watchHiding } from './watchHiding'
import { watchPlayer } from './watchPlayer'
import { watchSecurity } from './watchSecurity'

/**
 * Writes down the heist as it happens. Every step compares a handful of counters (the player's rounds and health,
 * the alert level, sightings, clues, new blast flashes); a few times a second it also looks over the guards, the
 * fires and the wreckage. Nothing here scans the site.
 */

export { createChronicle, type Beat, type ChronicleState } from './types'

const SLOW_SECONDS = 0.25

export function stepChronicle(world: World, dt: number): void {
  watchBlasts(world)
  watchEntry(world)
  watchPlayer(world)
  watchSecurity(world)
  const chronicle = world.chronicle
  chronicle.slowTimer -= dt
  if (chronicle.slowTimer > 0 && world.status === 'playing') return
  chronicle.slowTimer = SLOW_SECONDS
  watchGuards(world)
  watchHiding(world)
  watchWreckage(world)
}
