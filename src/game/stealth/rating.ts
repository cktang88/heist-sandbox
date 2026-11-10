import type { World } from '../world'

/**
 * How the heist went, for the end screen only (it changes nothing in play): a Ghost was never seen, left nobody
 * dead and nobody found; a Silent run never let the alarm ring; anything else was Loud.
 */
export type StealthRating = { name: 'GHOST' | 'SILENT' | 'LOUD'; line: string }

export function stealthRating(world: World): StealthRating {
  const stats = world.stats
  if (stats.alarms > 0 || world.alarm) return { name: 'LOUD', line: 'the whole block heard you' }
  if (stats.timesSpotted === 0 && stats.bodiesFound === 0 && stats.kills === 0) return { name: 'GHOST', line: 'never seen, nobody dead, nothing found' }
  return { name: 'SILENT', line: 'the alarm never rang' }
}
