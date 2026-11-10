import { centerOf, distance } from '../types'
import type { World } from '../world'

/**
 * How tense the heist is right now, from 0 to 1, from three things anyone watching would name: how alarmed the site
 * is, how recently a guard had eyes on the player, and how much is at stake (near the case, or carrying it).
 *
 *   tension = 0.5 * alert + 0.3 * heat + 0.2 * stake
 *
 * alert = site level / 4; heat = 1 when seen just now, fading to 0 over a minute and a half; stake = 1 while carrying
 * the case, otherwise rising from 0 at 60 tiles away to 0.6 beside it.
 */

const HEAT_FADE = 90
const STAKE_RANGE = 60

export function tensionOf(world: World): number {
  const alert = world.security.level / 4
  const seenAgo = world.clock - world.director.signals.lastSeenAt
  const heat = Math.max(0, 1 - seenAgo / HEAT_FADE)
  return 0.5 * alert + 0.3 * heat + 0.2 * stakeOf(world)
}

/** How close the player is to the prize. */
export function stakeOf(world: World): number {
  if (world.player.hasLoot) return 1
  const gap = distance(centerOf(world.player), centerOf(world.loot))
  return 0.6 * Math.max(0, 1 - gap / STAKE_RANGE)
}

/**
 * Where tension should be at this point of the heist: low while the player finds his feet, climbing as he closes on
 * the case, highest on the way out. The director nudges the real tension toward it.
 */
export function targetTension(world: World): number {
  return 0.2 + 0.45 * stakeOf(world)
}
