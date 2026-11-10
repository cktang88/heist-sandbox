import { describeFilter } from '../intel/describe'
import { feetOf } from '../security/model'
import type { World } from '../world'
import { guardName } from './names'
import { note } from './note'
import type { Beat } from './types'

/**
 * What the security force noticed and the player learned: sightings, the alert level and why it rose, bodies found,
 * clues gathered (and whether they were true), and the case being moved.
 */

/** A second sighting is only worth a line after this long without one. */
const SPOTTED_AGAIN = 25
/** Things that happened this recently explain an alert. */
const CAUSE_WINDOW = 4

export function watchSecurity(world: World): void {
  const seen = world.chronicle.security
  if (world.stats.timesSpotted > seen.spotted) {
    seen.spotted = world.stats.timesSpotted
    const index = world.guards.findIndex((guard) => guard.seesPlayer)
    if (index >= 0) world.chronicle.tally.seenBy.add(index)
    if (world.clock - seen.lastSpottedBeat > SPOTTED_AGAIN) {
      seen.lastSpottedBeat = world.clock
      note(world, 'spotted', world.player, { who: index >= 0 ? guardName(world, index) : undefined, n: seen.spotted })
    }
  }
  watchLevel(world)
  const bodies = world.security.reportedBodies
  if (bodies.size > seen.bodies) {
    seen.bodies = bodies.size
    const victim = [...bodies].at(-1) ?? -1
    const body = world.guards[victim]
    if (body) note(world, 'bodyFound', feetOf(body), { who: guardName(world, victim) })
  }
  const clues = world.intel.clues
  for (; seen.clues < clues.length; seen.clues += 1) {
    const clue = clues[seen.clues]
    note(world, 'clue', world.player, { detail: describeFilter(clue.filter), who: clue.origin, truth: clue.about === world.intel.real, n: clue.id })
  }
  if (world.intel.move.moves > seen.moves) {
    seen.moves = world.intel.move.moves
    const place = world.intel.places[world.intel.real]
    if (place) note(world, 'caseMoved', { x: place.x + place.w / 2, y: place.floorY })
  }
}

function watchLevel(world: World): void {
  const seen = world.chronicle.security
  const level = world.security.level
  const before = seen.level
  seen.level = level
  if (level <= before) return
  const tally = world.chronicle.tally
  tally.peakLevel = Math.max(tally.peakLevel, level)
  if (level >= 3 && before < 3) tally.alarms += 1
  note(world, 'alert', world.player, { n: level, detail: causeOf(world) })
}

/** Why the level rose, from what the chronicle saw just before, or failing that from the control room's last words. */
export function causeOf(world: World): string {
  const recent = world.chronicle.beats.filter((beat) => world.clock - beat.t <= CAUSE_WINDOW)
  const kinds = new Set(recent.map((beat: Beat) => beat.kind))
  if (kinds.has('explosion')) return 'explosion'
  if (kinds.has('bodyFound')) return 'body'
  if (kinds.has('spotted')) return 'sighting'
  const said = world.security.log.slice(-3).join(' ').toLowerCase()
  if (said.includes('camera')) return 'camera'
  if (said.includes('alarm button')) return 'alarm button'
  if (said.includes('shots fired')) return 'gunfire'
  if (said.includes('not answering')) return 'missed check-in'
  if (said.includes('fire')) return 'fire'
  if (said.includes('relay')) return 'radio'
  if (said.includes('power') || said.includes('breaker')) return 'power'
  if (said.includes('parachute') || said.includes('chute')) return 'parachute'
  if (said.includes('noise')) return 'noise'
  if (said.includes('open door') || said.includes('forced lock') || said.includes('window') || said.includes('rope') || said.includes('line')) return 'tampering'
  if (said.includes('man down')) return 'body'
  if (said.includes('contact')) return 'sighting'
  return 'unknown'
}
