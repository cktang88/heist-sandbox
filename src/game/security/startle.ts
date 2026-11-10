import { centerOf, distance } from '../types'
import type { World } from '../world'
import { STARTLE } from '../stealth/tuning'
import { bark } from './barks'
import { enterCombat } from './combat'
import { eyeOf, isActive, type Guard } from './model'
import { hold } from './movement'
import { lightLevelAt } from '../light'
import { hasLineOfSight } from '../vision'
import { isAlerted } from './perception'
import { VISION } from './tuning'

/**
 * The surprise window. A guard who meets the intruder at arm's length with nobody else watching (opens the locker he
 * is in, walks round a corner into him, sees a colleague grabbed right in front of him) is startled: for a beat he
 * stares, gasps and reaches for his radio, and nothing is reported yet. Subdue him in that beat (a choke, a punch, a
 * kill, a grab) and nobody ever hears of it; let it run out and he does what he would have done at once: shout,
 * radio, fight. A second guard who can see it takes the window away.
 */

const GASPS = ['What the...', 'Wha-', 'Hey! Who...', 'Jesus!', 'What are you...']

/** The beat this guard gets: shorter for a veteran or an officer, almost none for a man already hunting. */
export function startleSeconds(guard: Guard): number {
  if (isAlerted(guard)) return STARTLE.hunting
  if (guard.role === 'officer') return STARTLE.officer
  return STARTLE.seconds[guard.tier]
}

/** Other guards awake, near enough and with a clear view of the player: they see it happen too. */
export function witnessesOf(world: World, guard: Guard): Guard[] {
  const at = centerOf(world.player)
  const lit = lightLevelAt(world, at) >= VISION.dim
  return world.guards.filter((other) => {
    if (other === guard || !isActive(other) || other.blindSeconds > 0 || other.startle) return false
    const gap = distance(eyeOf(other), at)
    // A scuffle a few steps away is heard and turned to whichever way he faced; in the dark only up close.
    return gap < (lit ? STARTLE.witnessRange : VISION.torchDarkRange) && hasLineOfSight(world.grid, eyeOf(other), at)
  })
}

/**
 * The guard has just come face to face with the player. Returns true if he is startled (the window is open);
 * false if he gets no window (too far off, or someone else is watching), in which case the caller treats it as an
 * ordinary sighting. Witnesses, if any, go straight to a fight.
 */
export function confront(world: World, guard: Guard): boolean {
  if (guard.startle) return true
  if (!isActive(guard) || distance(eyeOf(guard), centerOf(world.player)) > STARTLE.range) return false
  const witnesses = witnessesOf(world, guard)
  if (witnesses.length > 0) {
    for (const other of witnesses) enterCombat(world, other, centerOf(world.player))
    return false
  }
  const seconds = startleSeconds(guard)
  guard.startle = { seconds, total: seconds }
  guard.radio = null
  guard.awareness = Math.max(guard.awareness, 0.9)
  guard.facing = centerOf(world.player).x >= guard.x + guard.w / 2 ? 1 : -1
  // Picked without the shared random stream, so a startle does not reshuffle everything that follows.
  bark(world, guard, GASPS[(world.guards.indexOf(guard) + Math.floor(world.clock)) % GASPS.length], true)
  return true
}

/**
 * While startled he stands frozen, facing the man. Returns true while the window is open. When it runs out he is
 * an ordinary guard who has spotted the intruder: the fight starts, and with it the shout and the radio call.
 */
export function stepStartle(world: World, guard: Guard, dt: number): boolean {
  const startle = guard.startle
  if (!startle) return false
  startle.seconds -= dt
  hold(world, guard, dt)
  guard.facing = centerOf(world.player).x >= guard.x + guard.w / 2 ? 1 : -1
  if (startle.seconds > 0) return true
  guard.startle = null
  world.stats.timesSpotted += 1
  enterCombat(world, guard, centerOf(world.player))
  return false
}
