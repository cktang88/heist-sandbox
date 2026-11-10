import type { Guard } from '../guards'
import { createRagdoll, JOINT } from '../ragdoll'
import type { Vec } from '../types'
import type { World } from '../world'

/**
 * A body is a guard who is down: dead, or out cold. Either way he lies as a ragdoll, which is what gets carried,
 * thrown, stuffed into a locker and found. A man tied up while conscious kneels; picked up, he goes limp like the rest.
 */

export function isBody(guard: Guard): boolean {
  return (guard.mode === 'dead' || guard.out) && guard.ragdoll !== null
}

/** Where a body lies (its hip), or where the man stands. */
export function bodyAt(guard: Guard): Vec {
  const hip = guard.ragdoll?.points[JOINT.hip]
  return hip ? { x: hip.x, y: hip.y } : { x: guard.x + guard.w / 2, y: guard.y + guard.h - 0.3 }
}

/** On the floor, in sight: not on the player's shoulder and not stuffed in a cupboard. */
export function bodyInOpen(world: World, guard: Guard): boolean {
  return isBody(guard) && guard.hiddenIn === null && world.guards[world.stealth.carried ?? -1] !== guard
}

/**
 * Knocks a guard out cold for `seconds`: he drops limp where he stands, his radio call cut off. Counted once as a
 * knockout for the end screen.
 */
export function knockOutCold(world: World, guard: Guard, seconds: number): void {
  if (guard.mode === 'dead') return
  if (!guard.out) world.stats.knockouts += 1
  guard.out = true
  guard.stunSeconds = Math.max(guard.stunSeconds, seconds)
  guard.radio = null
  guard.startle = null
  guard.seesPlayer = false
  if (world.melee.shield === guard) world.melee.shield = null
  guard.ragdoll ??= createRagdoll({ x: guard.x + guard.w / 2, y: guard.y + guard.h }, { x: guard.vx * 0.3, y: 0 }, world.rng)
}

/** Keeps the man's box over his limp body, so anything asking where he is (reach, noise, cameras) finds him there. */
export function followBody(guard: Guard): void {
  const hip = guard.ragdoll?.points[JOINT.hip]
  if (!hip) return
  guard.x = hip.x - guard.w / 2
  guard.y = hip.y + 0.7 - guard.h
  guard.vx = 0
  guard.vy = 0
}

/** Puts a body's joints at a spot, lying still (stuffed in a locker, or dropped there). */
export function layBodyAt(guard: Guard, feet: Vec, facing: 1 | -1): void {
  const ragdoll = guard.ragdoll
  if (!ragdoll) return
  ragdoll.points.forEach((point, joint) => {
    const along = LYING[joint]
    point.x = feet.x + along.x * facing
    point.y = feet.y + along.y
    point.vx = 0
    point.vy = 0
  })
  ragdoll.sleep = null
  ragdoll.still = 0
}

/** Joint offsets of a man lying on his back, head toward -x, from a point on the floor under his hip. */
const LYING: readonly Vec[] = [
  { x: -0.8, y: -0.15 }, { x: -0.55, y: -0.14 }, { x: 0, y: -0.12 },
  { x: -0.4, y: -0.1 }, { x: -0.15, y: -0.08 }, { x: -0.4, y: -0.1 }, { x: -0.1, y: -0.08 },
  { x: 0.4, y: -0.12 }, { x: 0.8, y: -0.08 }, { x: 0.42, y: -0.12 }, { x: 0.82, y: -0.08 },
]
