import { feetOf } from '../security/model'
import type { Body, Vec } from '../types'
import type { World } from '../world'
import { placeName } from './place'
import type { Beat, BeatKind } from './types'

/** A long night still keeps its story short: past this the oldest routine beats are dropped first. */
const MAX_BEATS = 400
const ROUTINE: ReadonlySet<BeatKind> = new Set(['clue', 'spotted', 'alert', 'down', 'nearMiss'])
/** The frame of the story (tonight's conditions, the drop, the way in, the case, the end) is never dropped. */
const FRAME: ReadonlySet<BeatKind> = new Set(['tonight', 'landed', 'entered', 'caseFound', 'escaped', 'died'])

/** Writes a beat down, at the current time. `at` is a feet position, or a body whose feet are used. */
export function note(world: World, kind: BeatKind, at: Vec | Body | null, extra: Omit<Beat, 'kind' | 't' | 'place'> = {}): Beat {
  const feet = at === null ? null : 'h' in at ? feetOf(at) : at
  const beat: Beat = { kind, t: world.clock, place: feet ? placeName(world, feet) : '', ...extra }
  const beats = world.chronicle.beats
  beats.push(beat)
  if (beats.length > MAX_BEATS) {
    const routine = beats.findIndex((old) => ROUTINE.has(old.kind))
    const drop = routine >= 0 ? routine : beats.findIndex((old) => !FRAME.has(old.kind))
    beats.splice(Math.max(0, drop), 1)
  }
  return beat
}

/** The latest beat for a director event or condition, to write its outcome into. */
export function lastEvent(world: World, detail: string): Beat | null {
  const beats = world.chronicle.beats
  for (let index = beats.length - 1; index >= 0; index -= 1) if (beats[index].kind === 'event' && beats[index].detail === detail) return beats[index]
  return null
}
