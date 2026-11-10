import type { World } from '../world'
import { filterFor } from './describe'
import type { Clue, ClueSource, Detail, Place } from './types'

/** Written sources (rosters, manifests, notes) are right this often; people about 70% of the time (see interrogate.ts). */
export const WRITTEN_TRUTH = 0.9

export type ClueRequest = {
  source: ClueSource
  origin: string
  sourceKey: string
  detail: Detail
  /** Chance the source has the real place in mind; otherwise it names another candidate, believing it. */
  truth: number
}

/**
 * Makes a clue and adds it to the log. A wrong clue is always about another real candidate place,
 * so it sounds as plausible as a true one. A site with a single candidate cannot be wrong about it.
 */
export function recordClue(world: World, request: ClueRequest): Clue {
  const intel = world.intel
  const about = pickAbout(world, request.truth)
  const clue: Clue = {
    id: intel.clues.length, source: request.source, origin: request.origin, sourceKey: request.sourceKey,
    filter: filterFor(about, request.detail, world.rng), about: about.id, confirmed: false, stale: false,
  }
  confirmAgainst(intel.clues, clue)
  intel.clues.push(clue)
  intel.version += 1
  return clue
}

function pickAbout(world: World, truth: number): Place {
  const { places, real } = world.intel
  const others = places.filter((place) => place.id !== real)
  if (others.length === 0 || world.rng() < truth) return places[real]
  return others[Math.floor(world.rng() * others.length)]
}

/** Two independent sources pointing at the same place confirm each other. Stale clues no longer count. */
function confirmAgainst(clues: Clue[], clue: Clue): void {
  for (const other of clues) {
    if (other.stale || other.sourceKey === clue.sourceKey || other.about !== clue.about) continue
    other.confirmed = true
    clue.confirmed = true
  }
}

/** The case has moved: everything learned so far describes where it was. */
export function markAllStale(world: World): void {
  for (const clue of world.intel.clues) {
    clue.stale = true
    clue.confirmed = false
  }
  world.intel.version += 1
}
