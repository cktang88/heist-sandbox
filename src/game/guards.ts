import { burst } from './effects'
import { playSound } from './sounds'
import { createRagdoll, stepRagdoll } from './ragdoll'
import { thinkGuard } from './security/brain'
import { enterCombat } from './security/combat'
import { setMode, type Guard } from './security/model'
import { onHurt, onKilled } from './security/nerve'
import { beingDragged } from './security/selfPreservation'
import { freeOfSolid } from './security/movement'
import { deployResponders } from './security/response'
import { raiseLevel } from './security/report'
import { markUnderFire, witnessHit } from './security/takingFire'
import { isGuardBlast } from './security/guardFrags'
import { centerOf, type Vec } from './types'
import type { World } from './world'

/**
 * The guards' public surface. The behaviour lives in `security/`: perception, the state machine (brain),
 * patrols, searching, combat, radio and the control room. Other systems use only what is here.
 */
export { createGuard, type Guard, type GuardMode, type GuardState } from './security/model'
export { investigate } from './security/brain'
export { isShielded } from './security/combat'
export { shieldBlocks } from './security/shieldTeam'
export { restrainGuard } from './security/fear'
export { scrapeNoise } from './security/hearing'
export { canSee, visionOf } from './security/perception'
export { guardDropsThrough } from './security/holeDrop'

const UNAWARE_DAMAGE_BONUS = 3

export function updateGuard(world: World, guard: Guard, dt: number): void {
  guard.kick *= Math.exp(-14 * dt)
  guard.blindSeconds = Math.max(0, guard.blindSeconds - dt)
  guard.deafSeconds = Math.max(0, guard.deafSeconds - dt)
  guard.hitFlash = Math.max(0, guard.hitFlash - dt)
  guard.barkCooldown = Math.max(0, guard.barkCooldown - dt)
  if (guard.mode === 'dead') {
    guard.deadSeconds += dt
    if (guard.ragdoll) stepRagdoll(world.grid, guard.ragdoll, dt)
    return
  }
  if (guard.stunSeconds > 0) {
    guard.stunSeconds = Math.max(0, guard.stunSeconds - dt)
    // Out cold, he can still be hauled out of the line of fire by a colleague.
    if (guard.draggedBy === null || !beingDragged(world, guard, dt)) guard.vx = 0
  } else thinkGuard(world, guard, dt)
  // Off the stairs nobody stays inside solid tiles, whatever put him there (rubble falling on him, a dive, a buried landing).
  if (!guard.stairs) freeOfSolid(world, guard)
}

/**
 * Hurts a guard. An attack (a shot, a blast, a blow) on a guard who has not spotted the player does far more,
 * so stealth kills are quick, and tells him roughly where it came from. Hazards (fire, smoke, a flash) hurt
 * at face value and say nothing about the player. Returns true if killed.
 */
export function hurtGuard(world: World, guard: Guard, damage: number, from: Vec, reported: 'attack' | 'hazard' = 'attack'): boolean {
  if (guard.mode === 'dead') return false
  // A colleague's frag hurts like any blast but says nothing about where the intruder is.
  const cause = reported === 'attack' && isGuardBlast(world, from) ? 'hazard' : reported
  const bonus = cause === 'attack' && guard.state !== 'alert' ? UNAWARE_DAMAGE_BONUS : 1
  guard.hp -= damage * bonus
  guard.hitFlash = 0.1
  world.security.lastCasualtyAt = world.clock
  burst(world.effects, world.rng, centerOf(guard), 6, '#b3202a', 6)
  if (cause === 'attack') witnessHit(world, guard)
  if (guard.hp <= 0) {
    setMode(guard, 'dead')
    guard.announced = 'dead'
    guard.radio = null
    guard.ragdoll = createRagdoll({ x: guard.x + guard.w / 2, y: guard.y + guard.h }, { x: guard.vx, y: guard.vy }, world.rng)
    if (cause === 'attack') world.stats.kills += 1
    playSound(world, 'kill', guard)
    onKilled(world, guard)
    return true
  }
  onHurt(guard)
  if (cause !== 'attack') return false
  enterCombat(world, guard, from)
  markUnderFire(world, guard, from)
  return false
}

/** Knocks a guard out for a while: he drops whatever he was doing, including a radio call. */
export function stunGuard(guard: Guard, seconds: number): void {
  if (guard.mode === 'dead') return
  guard.stunSeconds = Math.max(guard.stunSeconds, seconds)
  guard.radio = null
}

/**
 * The alarm is ringing (site level 3 or more): the control room confirms the intruder and the armoured
 * response team drives in to sweep the building where he was last reported.
 */
export function raiseAlarm(world: World): void {
  raiseLevel(world, 3)
  deployResponders(world)
}

/** The broad mood renderers colour a guard by, whatever his detailed mode. */
export function guardMood(guard: Guard): 'calm' | 'suspicious' | 'alert' | 'dead' {
  return guard.state === 'patrol' ? 'calm' : guard.state
}
