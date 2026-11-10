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
/** At most this many sounds play at once; a blast that breaks forty things plays the loudest few, not forty. */
export const MAX_VOICES = 24
/** And at most this many of one kind start in one frame: a shotgun's nine pellet hits are one or two impacts. */
const SAME_KIND_PER_FRAME = 2

/**
 * Which of this frame's audible sounds to start, given how many voices are free: the loudest first, a couple of each
 * kind at most. Piling up dozens of identical sounds in one frame only clips the mix.
 */
export function chooseVoices<T extends { kind: SoundKind; loudness: number }>(sounds: readonly T[], free: number): T[] {
  const perKind = new Map<SoundKind, number>()
  const chosen: T[] = []
  for (const sound of [...sounds].sort((a, b) => b.loudness - a.loudness)) {
    if (chosen.length >= free) break
    const count = perKind.get(sound.kind) ?? 0
    if (count >= SAME_KIND_PER_FRAME) continue
    perKind.set(sound.kind, count + 1)
    chosen.push(sound)
  }
  return chosen
}

export function heardAt(kind: SoundKind, gap: number, blocked: boolean): Heard | null {
  const reach = REACH[kind] ?? MEDIUM
  const near = Math.max(0, 1 - gap / reach)
  const loudness = near * near * (blocked ? THROUGH_WALL : 1)
  return loudness < SILENT_BELOW ? null : { loudness, muffled: blocked }
}
