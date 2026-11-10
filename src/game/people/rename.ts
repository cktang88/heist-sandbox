import { nameOf as fallbackName } from '../security/barks'
import type { World } from '../world'
import { callName } from './people'
import type { PeopleState, Person } from './types'

/**
 * Until the radio and bark code ask the people layer for names, they call guards "Unit 7" or by a short fallback
 * list. This puts the real names in afterwards: in the radio log, in fresh barks, and in clue origins. Only roster
 * people are renamed (late arrivals already go by the fallback name). Little text is touched each time.
 */

const UNIT = /\bUnit (\d+)\b/g

/** New barks, every frame, so a fallback name is never on screen. */
export function renameBarks(world: World, people: PeopleState): void {
  for (const line of world.security.barks) {
    if (renamed.has(line)) continue
    renamed.add(line)
    line.text = renameFallbacks(world, people, renameUnits(world, people, line.text), line)
  }
}

/** The radio log and clue origins, a few times a second. */
export function renameRecords(world: World, people: PeopleState): void {
  const log = world.security.log
  for (let i = 0; i < log.length; i += 1) if (log[i].includes('Unit ')) log[i] = renameUnits(world, people, log[i])
  for (const clue of world.intel.clues) {
    const index = /^guard:(\d+)$/.exec(clue.sourceKey)
    const person = index ? rosterAt(world, people, Number(index[1])) : null
    if (!person) continue
    const fallback = fallbackName(Number(index![1]))
    if (clue.origin.startsWith(fallback)) clue.origin = clue.origin.replace(fallback, callName(people, person))
  }
}

const renamed = new WeakSet<object>()

function rosterAt(world: World, people: PeopleState, index: number): Person | null {
  const guard = world.guards[index]
  const person = guard ? people.byGuard.get(guard) : undefined
  return person?.roster ? person : null
}

function renameUnits(world: World, people: PeopleState, text: string): string {
  return text.replace(UNIT, (whole, number: string) => {
    const person = rosterAt(world, people, Number(number) - 1)
    return person ? callName(people, person) : whole
  })
}

/**
 * A bark naming a colleague by the fallback list ("They got Reyes!") is about someone just killed or being
 * dragged to safety; several guards share each fallback name, so the one meant is the latest dead, or the one
 * being dragged, or else the nearest.
 */
function renameFallbacks(world: World, people: PeopleState, text: string, at: { x: number; y: number }): string {
  const deaths = world.security.deaths
  const latest = deaths.length > 0 ? deaths[deaths.length - 1].victim : -1
  let best: { index: number; score: number } | null = null
  const word = /[A-Z][a-z]+/g
  for (const match of text.matchAll(word)) {
    for (let index = 0; index < world.guards.length; index += 1) {
      if (fallbackName(index) !== match[0]) continue
      const guard = world.guards[index]
      const score = index === latest ? 0 : guard.draggedBy !== null ? 1 : 2 + Math.abs(guard.x - at.x) + Math.abs(guard.y - at.y)
      if (!best || score < best.score) best = { index, score }
    }
    if (!best) continue
    const person = rosterAt(world, people, best.index)
    return person ? text.replace(match[0], callName(people, person)) : text
  }
  return text
}
