import type { World } from '../world'
import { composeDebrief, type Debrief } from './story/debrief'
import { recordOf } from './story/record'
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
export type { Debrief } from './story/debrief'
export type { HeistRecord } from './story/record'

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

/** The debrief for the heist as it stands (normally called once it has ended). */
export function debriefOf(world: World): Debrief {
  return composeDebrief(recordOf(world))
}

/** The debrief as plain text, for copying. */
export function debriefText(debrief: Debrief): string {
  const numbers = debrief.numbers.map((entry) => `${entry.label}: ${entry.value}`).join(' | ')
  const highlights = debrief.highlights.map((line) => `- ${line}`).join('\n')
  return [debrief.headline.toUpperCase(), debrief.dateline, '', debrief.story.join(' '), '', `Verdict: ${debrief.verdict.word}. ${debrief.verdict.line}`, numbers, highlights].filter((line) => line !== undefined).join('\n').trim()
}
