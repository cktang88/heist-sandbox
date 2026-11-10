import type { World } from '../world'
import { searchArea } from './area'
import { stepChatter } from './chatter'
import { stepLootMove } from './move'
import { candidatePlaces, putLootIn } from './places'
import { chooseDocuments } from './sources'
import type { PlaceKind } from './types'

/**
 * Intel's public surface. The case is hidden in one of several plausible places; people, papers and
 * computers say where, mostly correctly; going loud makes security move it and makes the old intel worthless.
 */
export { interrogateAction, type IntelAction } from './interrogate'
export { readAction, terminalClue, terminalLine } from './sources'
export { searchArea, type SearchArea } from './area'
export { describeFilter } from './describe'
export { createIntel, type Clue, type IntelState } from './types'

/**
 * Picks where the case really is, from the candidate places, and moves it there. Call once, at the end of
 * world creation. A site with a single candidate (the outpost's vault) keeps the case where it is.
 */
export function setupIntel(world: World): void {
  const intel = world.intel
  intel.places = candidatePlaces(world, world.rng)
  if (intel.places.length > 1) {
    intel.real = Math.floor(world.rng() * intel.places.length)
    putLootIn(world, intel.places[intel.real])
  }
  intel.documents = chooseDocuments(world)
}

export function stepIntel(world: World, dt: number): void {
  if (world.intel.places.length === 0) return
  stepChatter(world, dt)
  stepLootMove(world, dt)
}

/**
 * Living people who could still be made to talk: everyone not dead and not yet questioned, except a man tied up out
 * cold, who never comes round.
 */
export function talkersLeft(world: World): number {
  return world.guards.filter((guard) => guard.mode !== 'dead' && !(guard.out && guard.restrained) && !world.intel.questioned.has(guard)).length
}

/** The objective line for the HUD, which says only what the player has learned. */
export function objectiveText(world: World): string {
  if (world.player.hasLoot) return 'Get back to the van'
  const area = searchArea(world)
  if (area) return `Search ${area.label}`
  return world.intel.places.length > 1 ? 'Find the gold case: make someone talk' : 'Steal the gold case from the vault'
}

/** Puts the case in the candidate place of a kind, for scripted runs and tests that need it somewhere known. */
export function hideCaseIn(world: World, kind: PlaceKind): void {
  const place = world.intel.places.find((candidate) => candidate.kind === kind)
  if (!place) throw new Error(`no ${kind} among the candidate places`)
  world.intel.real = place.id
  putLootIn(world, place)
}
