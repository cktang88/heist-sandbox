import { burst } from './effects'
import type { GuardSpawn } from './level'
import { emitNoise } from './noise'
import { GRAVITY, moveBody } from './physics'
import { createRagdoll, stepRagdoll, type Ragdoll } from './ragdoll'
import { fireShot } from './projectiles'
import { isSolidAt } from './tiles'
import { triggerSlowmo } from './time'
import { centerOf, distance, type Body, type Vec } from './types'
import { hasLineOfSight, normalize } from './vision'
import type { World } from './world'

export type GuardState = 'patrol' | 'suspicious' | 'alert' | 'dead'

export type Guard = Body & {
  hp: number
  facing: 1 | -1
  state: GuardState
  /** 0 = has no idea, 1 = has spotted the player. */
  awareness: number
  homeX: number
  target: Vec | null
  wait: number
  shootCooldown: number
  alertSeconds: number
  lostSeconds: number
  /** Recoil shove, 0..1, straight after firing. */
  kick: number
  /** Seconds left of the white flash shown when hit. */
  hitFlash: number
  deadSeconds: number
  /** The limp body, once the guard is down. */
  ragdoll: Ragdoll | null
}

const WALK_SPEED = 2.4
const CHASE_SPEED = 6
const SIGHT_RANGE = 13
const ALERT_SIGHT_RANGE = 22
const PATROL_RANGE = 9
const ALARM_AFTER_SECONDS = 2.5
const SEARCH_SECONDS = 4
const UNAWARE_DAMAGE_BONUS = 3
const SHOT = { speed: 24, damage: 12, tileDamage: 6, spread: 0.07, push: 0 }
const SHOT_NOISE = 28

export function createGuard(spawn: GuardSpawn): Guard {
  return {
    x: spawn.x + 0.15, y: spawn.y - 1.6, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: false,
    hp: 100, facing: spawn.facing, state: 'patrol', awareness: 0, homeX: spawn.x,
    target: null, wait: 0, shootCooldown: 0.4, alertSeconds: 0, lostSeconds: 0, kick: 0, hitFlash: 0, deadSeconds: 0, ragdoll: null,
  }
}

/** Sends a calm guard to look at a spot. Fighting and dead guards ignore it. */
export function investigate(guard: Guard, at: Vec): void {
  if (guard.state === 'dead' || guard.state === 'alert') return
  guard.state = 'suspicious'
  guard.target = { x: at.x, y: at.y }
  guard.wait = 2.5
}

/** Hurts a guard. Guards who have not spotted the player take far more, so stealth kills are quick. Returns true if killed. */
export function hurtGuard(world: World, guard: Guard, damage: number, from: Vec): boolean {
  if (guard.state === 'dead') return false
  guard.hp -= damage * (guard.state === 'alert' ? 1 : UNAWARE_DAMAGE_BONUS)
  guard.hitFlash = 0.1
  burst(world.effects, world.rng, centerOf(guard), 6, '#b3202a', 6)
  if (guard.hp <= 0) {
    guard.state = 'dead'
    guard.ragdoll = createRagdoll({ x: guard.x + guard.w / 2, y: guard.y + guard.h }, { x: guard.vx, y: guard.vy }, world.rng)
    world.stats.kills += 1
    return true
  }
  becomeAlert(guard, from)
  return false
}

function becomeAlert(guard: Guard, at: Vec): void {
  if (guard.state !== 'alert') guard.alertSeconds = 0
  guard.state = 'alert'
  guard.awareness = 1
  guard.target = { x: at.x, y: at.y }
  guard.lostSeconds = SEARCH_SECONDS
}

function eyeOf(guard: Guard): Vec {
  return { x: guard.x + guard.w / 2, y: guard.y + 0.35 }
}

export function canSee(world: World, guard: Guard, target: Vec): boolean {
  const eye = eyeOf(guard)
  const alert = guard.state === 'alert'
  const dx = target.x - eye.x
  const dy = target.y - eye.y
  if (Math.hypot(dx, dy) > (alert || world.alarm ? ALERT_SIGHT_RANGE : SIGHT_RANGE)) return false
  if (!alert && (dx * guard.facing <= 0 || Math.abs(dy) > Math.abs(dx) * 0.8 + 0.8)) return false
  return hasLineOfSight(world.grid, eye, target)
}

export function updateGuard(world: World, guard: Guard, dt: number): void {
  guard.kick *= Math.exp(-14 * dt)
  guard.hitFlash = Math.max(0, guard.hitFlash - dt)
  if (guard.state === 'dead') {
    guard.deadSeconds += dt
    if (guard.ragdoll) stepRagdoll(world.grid, guard.ragdoll, dt)
    return
  }

  const center = centerOf(guard)
  const playerCenter = centerOf(world.player)
  const gap = distance(center, playerCenter)
  const sees = canSee(world, guard, playerCenter)
  notice(world, guard, sees, gap, playerCenter, dt)

  let walk = 0
  if (guard.state === 'alert') walk = fight(world, guard, sees, gap, playerCenter, dt)
  else if (guard.state === 'suspicious') walk = search(guard, center, dt)
  else walk = patrol(world, guard, center)

  guard.vx += (walk - guard.vx) * Math.min(1, dt * 12)
  guard.vy += GRAVITY * dt
  const blocked = moveBody(world.grid, guard, dt)
  if (!blocked || walk === 0) return
  if (guard.state === 'patrol') guard.facing = guard.facing === 1 ? -1 : 1
  else if (guard.state === 'suspicious') guard.target = center
  else if (guard.onGround) guard.vy = -13
}

function notice(world: World, guard: Guard, sees: boolean, gap: number, playerCenter: Vec, dt: number): void {
  if (!sees) {
    if (!world.alarm) guard.awareness = Math.max(0, guard.awareness - dt * 0.4)
    return
  }
  const rate = (gap < 5 ? 5 : 1.6) * (guard.state === 'suspicious' ? 1.5 : 1)
  guard.awareness = Math.min(1, guard.awareness + dt * rate)
  if (guard.awareness < 1 || guard.state === 'alert') return
  becomeAlert(guard, playerCenter)
  world.stats.timesSpotted += 1
  triggerSlowmo(world.time, 0.7, 0.25)
  emitNoise(world, eyeOf(guard), 10)
}

function fight(world: World, guard: Guard, sees: boolean, gap: number, playerCenter: Vec, dt: number): number {
  guard.alertSeconds += dt
  if (guard.alertSeconds > ALARM_AFTER_SECONDS) world.alarm = true
  guard.shootCooldown -= dt

  if (!sees) {
    guard.lostSeconds -= dt
    if (guard.lostSeconds <= 0 && !world.alarm) {
      guard.state = 'suspicious'
      guard.wait = 3
      guard.awareness = 0.6
      return 0
    }
    const dx = (guard.target?.x ?? playerCenter.x) - (guard.x + guard.w / 2)
    if (Math.abs(dx) < 0.6) return 0
    guard.facing = dx > 0 ? 1 : -1
    return guard.facing * CHASE_SPEED
  }

  guard.target = playerCenter
  guard.lostSeconds = SEARCH_SECONDS
  guard.facing = playerCenter.x >= guard.x + guard.w / 2 ? 1 : -1
  if (guard.shootCooldown <= 0) {
    const eye = eyeOf(guard)
    const aim = normalize(playerCenter.x - eye.x, playerCenter.y - eye.y)
    fireShot(world, eye, aim, { kind: 'bullet', fromPlayer: false, ...SHOT })
    emitNoise(world, eye, SHOT_NOISE)
    guard.kick = 0.7
    guard.shootCooldown = 0.5 + world.rng() * 0.45
  }
  return gap > 6 ? guard.facing * CHASE_SPEED : 0
}

function search(guard: Guard, center: Vec, dt: number): number {
  const dx = (guard.target?.x ?? center.x) - center.x
  if (Math.abs(dx) > 0.8) {
    guard.facing = dx > 0 ? 1 : -1
    return guard.facing * WALK_SPEED * 1.4
  }
  guard.wait -= dt
  guard.facing = Math.floor(guard.wait / 0.9) % 2 === 0 ? 1 : -1
  if (guard.wait <= 0) {
    guard.state = 'patrol'
    guard.target = null
  }
  return 0
}

function patrol(world: World, guard: Guard, center: Vec): number {
  const ledgeAhead = !isSolidAt(world.grid, center.x + guard.facing * 0.7, guard.y + guard.h + 0.5)
  const tooFar = (center.x - guard.homeX) * guard.facing > PATROL_RANGE
  if (guard.onGround && (ledgeAhead || tooFar)) guard.facing = guard.facing === 1 ? -1 : 1
  return guard.facing * WALK_SPEED
}

/** When the alarm trips, every guard heads for where the player was last seen. */
export function raiseAlarm(world: World): void {
  const at = centerOf(world.player)
  for (const guard of world.guards) {
    investigate(guard, at)
    guard.awareness = Math.max(guard.awareness, 0.7)
  }
}
