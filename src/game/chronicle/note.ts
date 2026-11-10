import { feetOf } from '../security/model'
import type { Body, Vec } from '../types'
import type { World } from '../world'
import { placeName } from './place'
import type { Beat, BeatKind } from './types'

/** A long night still keeps its story short: past this the oldest routine beats are dropped first. */
const MAX_BEATS = 400
const ROUTINE: ReadonlySet<BeatKind> = new Set(['clue', 'spotted', 'alert', 'down', 'nearMiss'])

/** Writes a beat down, at the current time. `at` is a feet position, or a body whose feet are used. */
export function note(world: World, kind: BeatKind, at: Vec | Body | null, extra: Omit<Beat, 'kind' | 't' | 'place'> = {}): Beat {
  const feet = at === null ? null : 'h' in at ? feetOf(at) : at
  const beat: Beat = { kind, t: world.clock, place: feet ? placeName(world, feet) : '', ...extra }
  const beats = world.chronicle.beats
  beats.push(beat)
  if (beats.length > MAX_BEATS) {
    const drop = beats.findIndex((old) => ROUTINE.has(old.kind))
    beats.splice(drop >= 0 ? drop : 0, 1)
  }
  return beat
}

/** The latest beat for a director event or condition, to write its outcome into. */
export function lastEvent(world: World, detail: string): Beat | null {
  const beats = world.chronicle.beats
  for (let index = beats.length - 1; index >= 0; index -= 1) if (beats[index].kind === 'event' && beats[index].detail === detail) return beats[index]
  return null
}
