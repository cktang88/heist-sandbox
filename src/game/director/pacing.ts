import type { World } from '../world'
import { targetTension, tensionOf } from './tension'
import type { DirectorState, EventDef, Mood } from './types'

/**
 * The pacing rule, in plain words:
 *  - Leave the first 40 seconds alone: the player is landing and looking around.
 *  - Never start a timed event within 40 seconds of the last one, nor while two are under way.
 *  - When everything is on fire (tension above 0.75), add nothing: let the player deal with it.
 *  - Otherwise compare tension with where it should be (`targetTension`, rising as the player nears the case):
 *    well below, raise it (more eyes, a patrol swap); well above, release it (a window: a smoke break, a blackout).
 *  - Close to target, wait, unless nothing has happened for 90 seconds: then break the dead stretch either way.
 * Reactive events answer the player instead, and only need 12 seconds since the last start.
 */

export const OPENING = 40
export const MIN_GAP = 40
export const DEAD_STRETCH = 90
export const REACTIVE_GAP = 12
const MAX_RUNNING = 2
const TOO_HOT = 0.75
const BAND = 0.12

export type Decision = { mood: Mood | null; why: string }

export function decideMood(world: World): Decision {
  const director = world.director
  const tension = tensionOf(world)
  director.tension = tension
  const since = world.clock - director.lastEventAt
  if (world.clock < OPENING) return { mood: null, why: 'opening' }
  if (director.running.length >= MAX_RUNNING) return { mood: null, why: 'busy' }
  if (since < MIN_GAP) return { mood: null, why: 'spacing' }
  if (tension > TOO_HOT) return { mood: null, why: 'too hot' }
  const target = targetTension(world)
  if (tension < target - BAND) return { mood: 'raise', why: 'below target' }
  if (tension > target + BAND) return { mood: 'release', why: 'above target' }
  if (since >= DEAD_STRETCH) return { mood: tension < target ? 'raise' : 'release', why: 'dead stretch' }
  return { mood: null, why: 'on course' }
}

/** The timed events that could start now in this mood: ready, off cooldown, and not used up. */
export function candidates(world: World, events: readonly EventDef[], mood: Mood): EventDef[] {
  return events.filter((event) => event.kind === 'timed' && event.mood === mood && available(world.director, event, world.clock) && event.ready(world))
}

export function available(director: DirectorState, event: EventDef, clock: number): boolean {
  const used = director.history.filter((record) => record.id === event.id).length
  return used < event.repeats && clock >= (director.cooldowns.get(event.id) ?? 0) && !director.running.some((running) => running.id === event.id)
}
