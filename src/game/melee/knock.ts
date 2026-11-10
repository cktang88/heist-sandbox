import { hurtTile } from '../destruction'
import { hurtGuard, stunGuard, type Guard } from '../guards'
import { emitNoise } from '../noise'
import { GRAVITY, moveBody } from '../physics'
import { playSound } from '../sounds'
import { tileAt } from '../tiles'
import { centerOf, type Body } from '../types'
import type { World } from '../world'
import type { Knock } from './state'

/**
 * A guard knocked off his feet travels under his own momentum: he skids, drops off ledges and down holes,
 * smashes through glass in his way, and is hurt by a long fall. While he flies his own code is kept switched off.
 */

const FRICTION = 8
const REST_SPEED = 0.3
const SAFE_FALL_SPEED = 20
const FALL_DAMAGE_PER_SPEED = 8
/** Slower than this and a body bounces off glass instead of going through. */
const GLASS_BREAK_SPEED = 2
const GLASS_NOISE = 10

/** Sends a guard flying and keeps him down for at least `stunSeconds`. A second knock replaces the first. */
export function knockGuard(world: World, guard: Guard, vx: number, vy: number, stunSeconds: number): void {
  if (guard.mode === 'dead') return
  stunGuard(guard, stunSeconds)
  const found = world.melee.knocks.find((knock) => knock.guard === guard)
  if (found) Object.assign(found, { vx, vy })
  else world.melee.knocks.push({ guard, vx, vy })
}

export function stepKnocks(world: World, dt: number): void {
  world.melee.knocks = world.melee.knocks.filter((knock) => !carry(world, knock, dt))
}

/** Moves one knocked guard. Returns true once he has come to rest (or died). */
function carry(world: World, knock: Knock, dt: number): boolean {
  const { guard } = knock
  if (guard.mode === 'dead' || world.melee.shield === guard) return true
  // A stunned guard's own code does not move him at all (not even gravity), so this keeps him in hand until he lands.
  guard.stunSeconds = Math.max(guard.stunSeconds, dt * 2)
  knock.vy += GRAVITY * dt
  smashGlassAhead(world, guard, knock.vx)
  guard.vx = knock.vx
  guard.vy = knock.vy
  const falling = knock.vy
  moveBody(world.grid, guard, dt)
  knock.vx = guard.vx
  knock.vy = guard.vy
  if (!guard.onGround) return false
  if (falling > SAFE_FALL_SPEED && hurtGuard(world, guard, (falling - SAFE_FALL_SPEED) * FALL_DAMAGE_PER_SPEED, centerOf(guard), 'hazard')) return true
  knock.vx *= Math.exp(-FRICTION * dt)
  if (Math.abs(knock.vx) > REST_SPEED) return false
  guard.vx = 0
  return true
}

/** A body moving fast enough breaks any pane in front of it. */
export function smashGlassAhead(world: World, body: Body, vx: number): void {
  if (Math.abs(vx) < GLASS_BREAK_SPEED) return
  const column = vx > 0 ? Math.floor(body.x + body.w + 0.1) : Math.floor(body.x - 0.1)
  for (let row = Math.floor(body.y); row <= Math.floor(body.y + body.h - 0.01); row += 1) smashGlass(world, column, row)
}

/** Breaks a glass tile, loudly. Returns true if there was glass there. */
export function smashGlass(world: World, x: number, y: number): boolean {
  if (tileAt(world.grid, x, y) !== 'glass') return false
  hurtTile(world, x, y, Number.MAX_SAFE_INTEGER)
  const at = { x: x + 0.5, y: y + 0.5 }
  playSound(world, 'glass', at)
  emitNoise(world, at, GLASS_NOISE)
  return true
}
