import type { SoundKind } from './game/sounds'

/** How far each kind of sound carries, in tiles. Beyond it the sound is not played at all. */
const QUIET = 12
const MEDIUM = 28
const LOUD = 60
const HUGE = 110

const REACH: Partial<Record<SoundKind, number>> = {
  footstep: QUIET, keyboard: QUIET, switch: QUIET, pickup: QUIET, beep: QUIET, reload: QUIET, radio: QUIET, spark: QUIET, spray: QUIET,
  door: MEDIUM, impact: MEDIUM, kill: MEDIUM, glass: MEDIUM, shout: MEDIUM, elevator: MEDIUM, elevatorDing: MEDIUM, fire: MEDIUM, smokePop: MEDIUM,
  pistol: MEDIUM, alarm: LOUD, collapse: LOUD, rifle: LOUD, shotgun: LOUD, sniper: LOUD, guardShot: LOUD, rocket: LOUD, flashbang: LOUD,
  explosion: HUGE,
}

/** A wall or floor in the way takes this share of the loudness and dulls what is left. */
const THROUGH_WALL = 0.4
const SILENT_BELOW = 0.02

export type Heard = { loudness: number; muffled: boolean }

/**
 * How a sound reaches the listener: full volume beside it, fading to nothing at the edge of its reach,
 * and quieter and duller when something solid is in the way. Null means too faint to play.
 */
export function heardAt(kind: SoundKind, gap: number, blocked: boolean): Heard | null {
  const reach = REACH[kind] ?? MEDIUM
  const near = Math.max(0, 1 - gap / reach)
  const loudness = near * near * (blocked ? THROUGH_WALL : 1)
  return loudness < SILENT_BELOW ? null : { loudness, muffled: blocked }
}
