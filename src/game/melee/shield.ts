import { hurtGuard, stunGuard, type Guard } from '../guards'
import type { Input } from '../input'
import { capPlayerSpeed } from '../physprops/pace'
import { boxHitsSolid } from '../physics'
import { enterCombat } from '../security/combat'
import { stopsShotsAt } from '../tiles'
import { toolIndex, TOOLS } from '../toolDefs'
import { centerOf, type Rect, type Vec } from '../types'
import type { World } from '../world'

/**
 * Holding grab right behind a guard who has not noticed the player, or one who is stunned, takes him as a human
 * shield. He is held in front, between the player and whoever is shooting: their bullets hit him, and the guards'
 * own rule against firing through a colleague makes them hold fire. The player shuffles, pistol only.
 * Letting go frees him (and he fights); a punch knocks him out, a kick shoves him away.
 */

const TAKE_REACH = 1.2
const SAME_FLOOR = 0.6
const SHIELD_SPEED = 3
/** Distance between the player's middle and his shield's. */
const HOLD_GAP = 0.55
/** Kept topped up while held, so his own code leaves him be. */
const HELD_STUN = 0.1
const BULLET_STEP = 0.25
/** The one gun that can be fired with an arm round a man's neck. */
const ONE_HANDED = toolIndex('pistol')

export function holdShield(world: World, input: Input, dt: number): void {
  const held = world.melee.shield
  if (!input.grab) {
    if (held) releaseShield(world, true)
    return
  }
  if (held?.mode === 'dead') {
    world.melee.shield = null
    return
  }
  const guard = held ?? (world.physProps.grabbed ? null : shieldInReach(world))
  if (!guard) return
  if (!held) {
    world.melee.shield = guard
    world.player.tool = ONE_HANDED
    world.player.reload = 0
  }
  keepHold(world, guard, dt)
}

/** Lets the shield go. A guard who is merely held, not knocked out, turns on the player at once. */
export function releaseShield(world: World, turnsOnPlayer: boolean): void {
  const guard = world.melee.shield
  world.melee.shield = null
  if (!guard || guard.mode === 'dead' || !turnsOnPlayer) return
  guard.stunSeconds = 0
  enterCombat(world, guard, centerOf(world.player))
}

function shieldInReach(world: World): Guard | null {
  const center = centerOf(world.player)
  const feet = world.player.y + world.player.h
  return world.guards.find((guard) => {
    if (guard.mode === 'dead' || Math.abs(guard.y + guard.h - feet) > SAME_FLOOR) return false
    const dx = center.x - centerOf(guard).x
    const behind = dx * guard.facing < 0
    return Math.abs(dx) < TAKE_REACH && (guard.stunSeconds > 0 || (guard.state !== 'alert' && behind))
  }) ?? null
}

function keepHold(world: World, guard: Guard, dt: number): void {
  const player = world.player
  capPlayerSpeed(world, SHIELD_SPEED, dt)
  if (TOOLS[player.tool].id !== 'pistol') player.tool = ONE_HANDED
  stunGuard(guard, HELD_STUN)
  const facing = player.facing
  const spot = { ...guard, x: player.x + player.w / 2 + facing * HOLD_GAP - guard.w / 2, y: player.y + player.h - guard.h }
  if (boxHitsSolid(world.grid, spot)) {
    // He is up against a wall: the player stays behind him rather than walking through him.
    const x = guard.x + guard.w / 2 - facing * HOLD_GAP - player.w / 2
    if (!boxHitsSolid(world.grid, { ...player, x })) player.x = x
  } else {
    guard.x = spot.x
    guard.y = spot.y
  }
  Object.assign(guard, { vx: 0, vy: 0, onGround: true, facing, crouching: false })
}

/** Guards' bullets that would reach the shield this frame, before the player, hit him instead. */
export function catchBullets(world: World, dt: number): void {
  const shield = world.melee.shield
  if (!shield) return
  world.projectiles = world.projectiles.filter((shot) => {
    if (shot.fromPlayer || shot.kind !== 'bullet') return true
    const hit = firstHit(world, shot, { x: shot.vx * dt, y: shot.vy * dt }, shield)
    if (!hit) return true
    if (hurtGuard(world, shield, shot.damage, hit, 'hazard')) world.melee.shield = null
    return false
  })
}

/** Where a shot's path this frame first enters the shield, or null if a wall or the player comes first. */
function firstHit(world: World, from: Vec, travel: Vec, shield: Rect): Vec | null {
  const steps = Math.max(1, Math.ceil(Math.hypot(travel.x, travel.y) / BULLET_STEP))
  for (let step = 1; step <= steps; step += 1) {
    const at = { x: from.x + (travel.x * step) / steps, y: from.y + (travel.y * step) / steps }
    if (stopsShotsAt(world.grid, at.x, at.y) || inside(world.player, at)) return null
    if (inside(shield, at)) return at
  }
  return null
}

function inside(box: Rect, at: Vec): boolean {
  return at.x >= box.x - 0.1 && at.x <= box.x + box.w + 0.1 && at.y >= box.y - 0.1 && at.y <= box.y + box.h + 0.1
}
