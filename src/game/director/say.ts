import { bark, sayAt } from '../security/barks'
import { feetOf, isActive, type Guard } from '../security/model'
import { log } from '../security/report'
import { playSound } from '../sounds'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'

/**
 * How the director's events announce themselves: never a pop-up, always something in the world. Radio traffic goes
 * into the control room's log and squawks out of the nearest guard's handset if he is close enough for the player to
 * hear it; a guard doing something new says so out loud.
 */

/** How close a guard's handset must be for the player to overhear it. */
const OVERHEAR_RANGE = 16

export function radio(world: World, text: string): void {
  log(world, text)
  const handset = nearestHandset(world)
  if (!handset) return
  const at = { x: handset.x + handset.w / 2, y: handset.y - 1.1 }
  sayAt(world, at, `[radio] ${text}`)
  playSound(world, 'radio', at)
}

export function say(world: World, guard: Guard, text: string): void {
  bark(world, guard, text, true)
}

/** A line spoken at a spot with nobody in particular saying it (a tannoy, a voice through a wall). */
export function voiceAt(world: World, at: Vec, text: string): void {
  sayAt(world, at, text)
}

function nearestHandset(world: World): Guard | null {
  const player = centerOf(world.player)
  let best: Guard | null = null
  let bestGap = OVERHEAR_RANGE
  for (const guard of world.guards) {
    if (!isActive(guard)) continue
    const feet = feetOf(guard)
    if (Math.abs(feet.x - player.x) > bestGap) continue
    const gap = distance(feet, player)
    if (gap < bestGap) {
      best = guard
      bestGap = gap
    }
  }
  return best
}
