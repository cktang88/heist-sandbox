import { lampIsLit } from '../../game/light'
import type { Lamp } from '../../game/site'
import type { World } from '../../game/world'

/** Alert level from which the site counts as in alarm, and emergency fittings start to pulse. */
export const ALARM_LEVEL = 3

/** Is the site in alarm? `world.alarm` is the old flag and stays in step with the level. */
export function inAlarm(world: World): boolean {
  return world.alarm || world.security.level >= ALARM_LEVEL
}

/** A cheap repeatable hash of two numbers into 0..1, so every lamp stutters in its own way. */
function hash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** Time slices a failing tube can change state in: about a twelfth of a second, like a starter clicking. */
const STUTTER_RATE = 12
/** Length of the windows in which a failing tube either behaves or acts up. */
const SPELL = 1.7

/**
 * A failing tube: steady most of the time, then a short spell of rapid off-on stutter.
 * The output only takes a few levels, so whatever follows it changes only when the level does.
 */
export function flickerLevel(seed: number, time: number): number {
  const spell = Math.floor(time / SPELL)
  if (hash(seed, spell) > 0.4) return 1
  // Only part of a bad spell stutters, so the failures do not all start on the same beat.
  const into = time / SPELL - spell
  const start = hash(spell, seed) * 0.5
  if (into < start || into > start + 0.45) return 1
  const slice = hash(seed + 0.5, Math.floor(time * STUTTER_RATE))
  return slice < 0.45 ? 0 : slice < 0.6 ? 0.35 : 1
}

/** An emergency beacon in alarm: a slow, strong pulse that never quite goes dark. */
export function alarmPulse(time: number): number {
  const wave = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * 0.9)
  return 0.15 + 1.35 * wave * wave
}

/** Is this colour mostly red? Red emergency fittings pulse in alarm; green exit signs stay steady. */
function isReddish(color: number): boolean {
  const r = (color >> 16) & 255
  const g = (color >> 8) & 255
  return r > 150 && g < 120
}

/** Is this a red emergency beacon that is pulsing because the site is in alarm? */
export function isAlarmBeacon(lamp: Lamp, alarm: boolean): boolean {
  return alarm && lamp.fixture === 'emergency' && isReddish(lamp.color)
}

/**
 * How brightly a lamp shines right now, as a multiple of its normal output: 0 when off.
 * The fitting's glow and any real light given to the lamp both follow this, so they never disagree.
 */
export function lampBrightness(world: World, lamp: Lamp, index: number, alarm: boolean): number {
  if (!lampIsLit(world, lamp)) return 0
  if (isAlarmBeacon(lamp, alarm)) return alarmPulse(world.clock + index * 0.013)
  if (lamp.fixture === 'emergency') return 0.7
  return lamp.flickers ? flickerLevel(index, world.clock) : 1
}
