import { burst } from './effects'
import { openDoor } from './interact'
import type { GuardSpawn } from './level'
import { emitNoise } from './noise'
import { GRAVITY, moveBody } from './physics'
import { playSound } from './sounds'
import { createRagdoll, stepRagdoll, type Ragdoll } from './ragdoll'
import { fireShot } from './projectiles'
import { isSolidAt, tileAt } from './tiles'
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
  climbing: boolean
  /** Armoured responders arrive when the alarm rings. They take more to bring down. */
  armored: boolean
}

const WALK_SPEED = 2.4
const CHASE_SPEED = 6
const SIGHT_RANGE = 13
const ALERT_SIGHT_RANGE = 22
const PATROL_RANGE = 9
const ALARM_AFTER_SECONDS = 2.5
const SEARCH_SECONDS = 4
const UNAWARE_DAMAGE_BONUS = 3
const ARMORED_HP = 220
const CLIMB_SPEED = 5
const RESPONDERS = 3
const LADDER_SEARCH_TILES = 45
const SHOT = { speed: 24, damage: 12, tileDamage: 6, spread: 0.07, push: 0 }
const SHOT_NOISE = 28

export function createGuard(spawn: GuardSpawn, armored = false): Guard {
  return {
    x: spawn.x + 0.15, y: spawn.y - 1.6, w: 0.7, h: 1.6, vx: 0, vy: 0, onGround: false,
    hp: armored ? ARMORED_HP : 100, facing: spawn.facing, state: 'patrol', awareness: 0, homeX: spawn.x,
    target: null, wait: 0, shootCooldown: 0.4, alertSeconds: 0, lostSeconds: 0, kick: 0, hitFlash: 0, deadSeconds: 0, ragdoll: null, climbing: false, armored,
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
    playSound(world, 'kill', guard)
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
  if (guard.state === 'alert' && !sees && useLadder(world, guard, dt)) return
  guard.climbing = false
  if (guard.state === 'alert') walk = fight(world, guard, sees, gap, playerCenter, dt)
  else if (guard.state === 'suspicious') walk = search(guard, center, dt)
  else walk = patrol(world, guard, center)

  guard.vx += (walk - guard.vx) * Math.min(1, dt * 12)
  guard.vy += GRAVITY * dt
  const blocked = moveBody(world.grid, guard, dt)
  if (!blocked || walk === 0) return
  if (guard.state === 'patrol') guard.facing = guard.facing === 1 ? -1 : 1
  else if (guard.state === 'suspicious') guard.target = center
  else if (!kickDoorOpen(world, guard) && guard.onGround) guard.vy = -13
}

/** An alerted guard does not wait for a key: a door in the way gets kicked open, loudly. */
function kickDoorOpen(world: World, guard: Guard): boolean {
  const ahead = { x: Math.floor(guard.x + guard.w / 2 + guard.facing * 0.8), y: Math.floor(guard.y + guard.h - 0.5) }
  if (tileAt(world.grid, ahead.x, ahead.y) !== 'door') return false
  openDoor(world.grid, ahead)
  world.structureChanged = true
  emitNoise(world, ahead, 16)
  playSound(world, 'door', ahead)
  return true
}

/**
 * Lets a hunting guard change floors: walk to the nearest ladder that goes the right way, then climb it.
 * Returns true when it has taken over the guard's movement for this frame.
 */
function useLadder(world: World, guard: Guard, dt: number): boolean {
  if (!guard.target) return false
  const centerX = guard.x + guard.w / 2
  const feetY = guard.y + guard.h
  const rise = guard.target.y + 0.8 - feetY

  if (guard.climbing) {
    const touching = [guard.y + guard.h / 2, feetY + 0.2].some((y) => tileAt(world.grid, Math.floor(centerX), Math.floor(y)) === 'ladder')
    if (!touching || Math.abs(rise) < 0.5) {
      // Step off with a small hop toward the target, clear of the ladder hole.
      guard.climbing = false
      guard.vy = -7
      guard.vx = (guard.target.x > centerX ? 1 : -1) * CHASE_SPEED
      return false
    }
    guard.vx = 0
    guard.vy = Math.sign(rise) * CLIMB_SPEED
    moveBody(world.grid, guard, dt)
    if (guard.vy === 0) {
      // Blocked (a locked hatch) or back on a floor: give up on this ladder.
      guard.climbing = false
      if (rise < 0) guard.target = { x: centerX, y: feetY - 0.8 }
    }
    return true
  }

  if (Math.abs(rise) < 1.5 || !guard.onGround) return false
  const column = findLadder(world, centerX, feetY, rise < 0)
  if (column === null) return false
  const offset = column + 0.5 - centerX
  if (Math.abs(offset) < 0.25) {
    guard.climbing = true
    guard.x = column + 0.5 - guard.w / 2
    return true
  }
  guard.facing = offset > 0 ? 1 : -1
  guard.vx = guard.facing * CHASE_SPEED
  guard.vy += GRAVITY * dt
  if (moveBody(world.grid, guard, dt)) kickDoorOpen(world, guard)
  return true
}

/** Nearest column on this floor with a ladder going up (or a ladder hole going down). */
function findLadder(world: World, fromX: number, feetY: number, goingUp: boolean): number | null {
  const bodyRow = Math.floor(feetY - 0.5)
  const start = Math.floor(fromX)
  for (let reach = 0; reach <= LADDER_SEARCH_TILES; reach += 1) {
    for (const column of reach === 0 ? [start] : [start + reach, start - reach]) {
      const found = goingUp
        ? tileAt(world.grid, column, bodyRow) === 'ladder' && tileAt(world.grid, column, bodyRow - 3) === 'ladder'
        : tileAt(world.grid, column, bodyRow + 1) === 'ladder'
      if (found) return column
    }
  }
  return null
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
    playSound(world, 'guardShot', eye)
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

/** When the alarm trips, every guard heads for where the player was last seen, and armoured backup arrives by road. */
export function raiseAlarm(world: World): void {
  const at = centerOf(world.player)
  for (const guard of world.guards) {
    investigate(guard, at)
    guard.awareness = Math.max(guard.awareness, 0.7)
  }
  for (let index = 0; index < RESPONDERS; index += 1) {
    // Backup drives in from the end of the street opposite the getaway van.
    const fromRight = world.extraction.x < world.grid.width / 2
    const x = fromRight ? world.grid.width - 4 - index * 2 : 3 + index * 2
    const responder = createGuard({ x, y: world.groundY, facing: fromRight ? -1 : 1 }, true)
    becomeAlert(responder, at)
    world.guards.push(responder)
  }
}
