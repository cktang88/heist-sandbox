import type { World } from '../world'

/**
 * How the heist went, for the end screen only (it changes nothing in play): a Ghost was never seen, left nobody
 * dead and nobody found; a Silent run never let the alarm ring; anything else was Loud.
 */
export type StealthRating = { name: 'GHOST' | 'SILENT' | 'LOUD'; line: string }

export function stealthRating(world: World): StealthRating {
  const stats = world.stats
  if (stats.alarms > 0 || world.alarm) return { name: 'LOUD', line: 'the whole block heard you' }
  // Nobody dead means nobody, however he died: shot, kicked off a roof, caught in a blast or a fire.
  const dead = world.guards.some((guard) => guard.mode === 'dead')
  if (!everSeen(world) && bodiesFound(world) === 0 && !dead) return { name: 'GHOST', line: 'never seen, nobody dead, nothing found' }
  return { name: 'SILENT', line: 'the alarm never rang' }
}

/** Bodies of the player's making that guards found; a man the rival crew knocked cold is not his. */
function bodiesFound(world: World): number {
  const rivals = [...world.stealth.found].filter((index) => world.director.rivalVictims.has(world.guards[index])).length
  return world.stats.bodiesFound - rivals
}

/** Seen by a guard, or caught by a camera or with his parachute: anything that told control where he was. */
export function everSeen(world: World): boolean {
  return world.stats.timesSpotted > 0 || world.security.lastContactAt > -Infinity
}
