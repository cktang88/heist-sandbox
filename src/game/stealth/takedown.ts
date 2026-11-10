import { hurtGuard, type Guard } from '../guards'
import { lightLevelAt } from '../light'
import { emitNoise } from '../noise'
import { enterCombat } from '../security/combat'
import { canSee } from '../security/perception'
import { confront } from '../security/startle'
import { VISION } from '../security/tuning'
import { playSound } from '../sounds'
import { centerOf, distance } from '../types'
import type { World } from '../world'
import { knockOutCold } from './bodies'
import { TAKEDOWN } from './tuning'

/**
 * Takedowns. On a guard who has not noticed the player, from behind or out of the dark:
 * - E (standing): a quick kill. Instant, a small sound, and a blood pool others can find.
 * - Hold E (crouched): a silent choke. He is seized at once and goes limp after a couple of seconds; let go early and
 *   he breaks free and fights. He wakes in a few minutes unless tied up.
 * From the front, or on a man who knows the player is there, only a noisy wrestle (a choke that takes longer and
 * that anyone near can hear). An armoured heavy cannot be choked from the front at all.
 * A startled guard (security/startle.ts) can be choked whichever way he faces: that is the chance the window gives.
 */

export type Takedown = { guard: Guard; quiet: boolean; heavy: boolean; startled: boolean }

const SAME_FLOOR = 0.8
/** Where the choked man is held, in front of the player. */
const HOLD_GAP = 0.5

/** The guard the player could take down right now, and how. */
export function takedownTarget(world: World): Takedown | null {
  const player = world.player
  const center = centerOf(player)
  const feet = player.y + player.h
  let best: Takedown | null = null
  let bestGap = TAKEDOWN.reach
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || guard.out || guard.restrained || guard.mode === 'surrendered' || guard === world.melee.shield) continue
    if (Math.abs(guard.y + guard.h - feet) > SAME_FLOOR) continue
    const gap = distance(centerOf(guard), center)
    if (gap >= bestGap) continue
    const behind = (center.x - centerOf(guard).x) * guard.facing < 0
    const dark = lightLevelAt(world, center) < VISION.dim
    const unaware = guard.state !== 'alert' && !guard.seesPlayer
    const quiet = unaware && (behind || dark)
    const startled = guard.startle !== null
    // An armoured man facing you, who is not frozen in surprise, cannot be grabbed.
    if (guard.armored && !behind && !startled) continue
    best = { guard, quiet: quiet || (startled && behind), heavy: guard.armored, startled }
    bestGap = gap
  }
  return best
}

/** The quick kill: only on a man who has no idea (or is frozen in surprise). */
export function quickKill(world: World, guard: Guard): void {
  const at = centerOf(guard)
  witnessTakedown(world, guard)
  hurtGuard(world, guard, 1000, centerOf(world.player))
  emitNoise(world, at, TAKEDOWN.killNoise)
}

/** Seizes the guard: from here he is held, and the choke runs while E stays down. */
export function startChoke(world: World, target: Takedown): void {
  const { guard } = target
  const struggle = !target.quiet
  const need = struggle ? TAKEDOWN.struggleSeconds : guard.armored ? TAKEDOWN.heavyChokeSeconds : TAKEDOWN.chokeSeconds
  const side = centerOf(guard).x >= centerOf(world.player).x ? 1 : -1
  world.stealth.choke = { guard: world.guards.indexOf(guard), t: 0, need, struggle, noiseIn: 0, side, x: world.player.x }
  // Choking the man who was startled ends his window: he is fighting for air now, not reaching for the radio.
  guard.startle = null
  guard.radio = null
  witnessTakedown(world, guard)
  hold(world, guard, side, world.player.x)
}

/** Each frame of a choke. Returns true while it goes on. */
export function stepChoke(world: World, held: boolean, dt: number): boolean {
  const choke = world.stealth.choke
  if (!choke) return false
  const guard = world.guards[choke.guard]
  if (guard.mode === 'dead' || guard.out) {
    world.stealth.choke = null
    return false
  }
  if (!held) {
    world.stealth.choke = null
    guard.stunSeconds = 0
    enterCombat(world, guard, centerOf(world.player))
    return false
  }
  hold(world, guard, choke.side, choke.x)
  choke.t += dt
  if (choke.struggle) {
    choke.noiseIn -= dt
    if (choke.noiseIn <= 0) {
      choke.noiseIn = TAKEDOWN.struggleNoiseEvery
      emitNoise(world, centerOf(guard), TAKEDOWN.struggleNoise)
      playSound(world, 'impact', centerOf(guard))
    }
  }
  if (choke.t < choke.need) return true
  world.stealth.choke = null
  knockOutCold(world, guard, TAKEDOWN.chokeOutSeconds)
  return false
}

/** Keeps the choked man in the player's arms: stunned, in front of him, and the player standing where he grabbed him. */
function hold(world: World, guard: Guard, side: 1 | -1, x: number): void {
  const player = world.player
  player.x = x
  guard.stunSeconds = Math.max(guard.stunSeconds, 0.2)
  guard.x = player.x + player.w / 2 + side * HOLD_GAP - guard.w / 2
  guard.y = player.y + player.h - guard.h
  guard.facing = side
  guard.vx = 0
  guard.vy = 0
  player.vx = 0
}

/**
 * Other guards who see a takedown happen react to it: one right there with nobody else around is startled, the rest
 * see the intruder and fight.
 */
export function witnessTakedown(world: World, victim: Guard): void {
  const at = centerOf(world.player)
  for (const other of world.guards) {
    if (other === victim || other.mode === 'dead' || other.out || other.stunSeconds > 0 || other.mode === 'surrendered') continue
    if (!canSee(world, other, at) || lightLevelAt(world, at) < VISION.dim && distance(centerOf(other), at) > VISION.darkRange) continue
    if (!confront(world, other)) enterCombat(world, other, at)
  }
}
