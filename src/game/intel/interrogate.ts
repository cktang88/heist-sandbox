import type { Guard } from '../guards'
import { emitNoise } from '../noise'
import { bark, nameOf } from '../security/barks'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { recordClue } from './clues'
import { spokenLine, type Voice } from './describe'
import type { Clue, Detail } from './types'
import { talkTerms } from '../people/tick'

/**
 * Questioning a guard who has given up, is held as a shield or is tied up. What he knows depends on who he is:
 * a rookie on the perimeter knows the building at best and may be guessing; a veteran or anyone working the
 * security room knows the kind of room or the room itself. About 70% of answers are right; a frightened man
 * is more truthful, a steady veteran stalls and lies more. Talking is audible, so doing it near other guards is risky.
 */

/** The same `{ prompt, key, hold, run }` shape interact.ts uses for everything E does. */
export type IntelAction = { prompt: string; key: string; hold?: number; run: () => void }

const REACH = 1.6
const TIER_TRUTH = { rookie: 0.66, regular: 0.7, veteran: 0.62 } as const
/** Truth gained per point of nerve below the middle (and lost above it). */
const FEAR_TRUTH = 0.3
const MID_NERVE = 0.5
/** A rookie posted outside does not really know; he guesses. */
const OUTSIDER_PENALTY = 0.1
const TRUTH_RANGE = { min: 0.4, max: 0.92 }
const FRIGHTENED = 0.4
const HOLD_SECONDS = { frightened: 1.5, plain: 2.5, veteran: 3.5 }
/** How far a quiet interrogation carries. */
const TALK_RADIUS = 6

export function interrogateAction(world: World): IntelAction | null {
  if (world.intel.places.length === 0) return null
  const guard = talkerInReach(world)
  if (!guard) return null
  const index = world.guards.indexOf(guard)
  if (world.intel.questioned.has(guard)) {
    // Someone who can still be tied up or taken down leaves E to that; a tied man just repeats himself.
    if (!guard.restrained) return null
    return { prompt: 'E: question again', key: `intel:again:${index}`, run: () => bark(world, guard, 'I told you everything!', true) }
  }
  return { prompt: 'Hold E: interrogate', key: `intel:ask:${index}`, hold: holdSeconds(guard), run: () => interrogate(world, guard) }
}

/** Alive, awake and unable to resist: hands up, tied, or held as a shield. Dead men tell nothing. */
export function canBeQuestioned(world: World, guard: Guard): boolean {
  // Out cold or shut in a cupboard, he can be asked nothing.
  if (guard.mode === 'dead' || guard.out || guard.hiddenIn !== null) return false
  return guard.restrained || guard.mode === 'surrendered' || world.melee.shield === guard
}

function talkerInReach(world: World): Guard | null {
  const shield = world.melee.shield
  if (shield && canBeQuestioned(world, shield)) return shield
  const center = centerOf(world.player)
  let best: Guard | null = null
  let bestGap = REACH
  for (const guard of world.guards) {
    const gap = distance(centerOf(guard), center)
    if (gap >= bestGap || !canBeQuestioned(world, guard)) continue
    best = guard
    bestGap = gap
  }
  return best
}

function holdSeconds(guard: Guard): number {
  if (guard.nerve < FRIGHTENED) return HOLD_SECONDS.frightened
  return guard.tier === 'veteran' ? HOLD_SECONDS.veteran : HOLD_SECONDS.plain
}

/** He talks: a clue goes in the log, he says it out loud, and anyone close enough hears voices. */
export function interrogate(world: World, guard: Guard): Clue | null {
  world.intel.questioned.add(guard)
  const index = world.guards.indexOf(guard)
  // A loyal man says nothing, whatever is done to him; a greedy or frightened one talks straighter.
  const terms = talkTerms(world, guard)
  if (terms.refuses) {
    if (terms.line) bark(world, guard, terms.line, true)
    return null
  }
  const truth = Math.min(TRUTH_RANGE.max, truthOf(world, guard) + terms.truthBonus)
  const clue = recordClue(world, { source: 'interrogation', origin: world.people?.nameOf(guard) ?? nameOf(index), sourceKey: `guard:${index}`, detail: detailKnownBy(world, guard), truth })
  bark(world, guard, spokenLine(clue.filter, voiceOf(world, guard)), true)
  emitNoise(world, centerOf(guard), TALK_RADIUS)
  return clue
}

/** How much he can know, from his role, where he works and how long he has been around. */
export function detailKnownBy(world: World, guard: Guard): Detail {
  const security = roomKindOf(world, guard) === 'security'
  if (guard.role === 'officer' || (guard.tier === 'veteran' && (guard.role === 'operator' || security))) return 'room'
  if (guard.tier === 'veteran' || guard.role === 'operator' || guard.role === 'heavy' || security) return 'kind'
  if (guard.tier === 'regular') return world.rng() < 0.5 ? 'band' : 'side'
  return 'building'
}

/** Chance that what he says is right. */
export function truthOf(world: World, guard: Guard): number {
  const fear = FEAR_TRUTH * (MID_NERVE - guard.nerve)
  const guess = isOutsider(world, guard) ? OUTSIDER_PENALTY : 0
  return Math.max(TRUTH_RANGE.min, Math.min(TRUTH_RANGE.max, TIER_TRUTH[guard.tier] + fear - guess))
}

function voiceOf(world: World, guard: Guard): Voice {
  if (isOutsider(world, guard)) return 'guessing'
  return guard.tier === 'veteran' && guard.nerve >= FRIGHTENED ? 'grudging' : 'plain'
}

/** A rookie with no room, or posted out in the grounds. */
function isOutsider(world: World, guard: Guard): boolean {
  if (guard.tier !== 'rookie') return false
  const room = guard.roomId === null ? undefined : world.rooms.find((candidate) => candidate.id === guard.roomId)
  return !room || room.building === 'grounds'
}

function roomKindOf(world: World, guard: Guard): string | undefined {
  return guard.roomId === null ? undefined : world.rooms.find((room) => room.id === guard.roomId)?.kind
}
