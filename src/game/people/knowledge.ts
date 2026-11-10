import { nearPlayer } from '../security/barks'
import { clearView } from '../security/perception'
import { eyeOf } from '../security/model'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import type { Person, TraitId } from './types'

/**
 * What the player has learned about each person, for the dossier: only what he could have seen or heard.
 * A trait is learned when it shows itself within earshot; a name when someone says it nearby, or from papers.
 */

const UP_CLOSE = 6
const PAPERS_REACH = 1.6

/** A trait just showed itself: the player learns it if he was close enough to notice. */
export function reveal(world: World, person: Person, trait: TraitId): void {
  if (!nearPlayer(world, person.guard) || person.knowledge.traits.includes(trait)) return
  person.knowledge.traits.push(trait)
}

/** Someone said this person's name, or talked about the bond between them, where the player could hear. */
export function overheard(world: World, speaker: Person, about: Person): void {
  if (!nearPlayer(world, speaker.guard)) return
  about.knowledge.named = true
  if (!speaker.knowledge.bonds.includes(about.id)) speaker.knowledge.bonds.push(about.id)
  if (!about.knowledge.bonds.includes(speaker.id)) about.knowledge.bonds.push(speaker.id)
}

/** Seen up close, questioned, or searched while helpless (his papers). Cheap distance tests first. */
export function watchPlayer(world: World, person: Person): void {
  const guard = person.guard
  const knowledge = person.knowledge
  const gap = distance(centerOf(guard), centerOf(world.player))
  if (gap > UP_CLOSE) return
  if (!knowledge.seen && clearView(world, eyeOf(guard), centerOf(world.player))) knowledge.seen = true
  const helpless = guard.mode === 'dead' || guard.stunSeconds > 0 || guard.restrained
  if (helpless && gap < PAPERS_REACH && !knowledge.papers) {
    knowledge.papers = true
    knowledge.named = true
    knowledge.seen = true
  }
  if (!knowledge.questioned && world.intel.questioned.has(guard)) {
    knowledge.questioned = true
    knowledge.named = true
    knowledge.seen = true
    for (const trait of person.traits) if ((trait === 'loyal' || trait === 'greedy' || trait === 'chatty' || trait === 'coward') && !knowledge.traits.includes(trait)) knowledge.traits.push(trait)
  }
}
