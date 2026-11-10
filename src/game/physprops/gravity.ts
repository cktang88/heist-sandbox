import type { PropState } from '../cover'
import { hurtGuard, stunGuard } from '../guards'
import { propBox, propCenter } from '../hazards/props'
import { emitNoise } from '../noise'
import { GRAVITY, moveBody } from '../physics'
import { playSound } from '../sounds'
import { isSolidAt, type Grid } from '../tiles'
import { overlaps, type Body, type Rect } from '../types'
import type { World } from '../world'
import { weightOf } from './kinds'
import { looseProps, rekeyIfMoved, shiftProp, type LooseProp } from './state'

/**
 * Loose props obey gravity and slide to a stop. Only the middle of a prop needs ground under it, so furniture
 * shoved half over a hole tips in, drops to the storey below (hurting whoever is underneath) and settles there.
 */

const FRICTION = 6
const STOP_SPEED = 0.2
/** Share of its width a prop rests on, and the width it needs to drop through a hole. */
const FOOTING = 0.6
const MIN_FOOTING = 0.5
/** Falling faster than this, it hurts whoever it lands on... */
const CRUSH_SPEED = 6
const CRUSH_DAMAGE = 1.2
const CRUSH_STUN = 2
/** ...and landing faster than this is heard. */
const THUD_SPEED = 4
const THUD_NOISE = 4
const THUD_NOISE_PER_WEIGHT = 3

export function settleLooseProps(world: World, dt: number): void {
  for (const { prop, loose } of looseProps(world)) {
    if (loose.flying || world.physProps.grabbed?.id === prop.id) continue
    if (loose.vx === 0 && loose.vy === 0 && isResting(world.grid, prop)) continue
    fall(world, prop, loose, dt)
  }
}

/** Is there floor under the middle of this prop? */
export function isSupported(grid: Grid, prop: PropState): boolean {
  const footing = footingOf(propBox(prop))
  const row = Math.floor(footing.y + footing.h + 0.05)
  for (let x = Math.floor(footing.x); x <= Math.floor(footing.x + footing.w - 0.001); x += 1) if (isSolidAt(grid, x, row)) return true
  return false
}

/** Standing still on a floor: supported, with its bottom right on the floor's surface (not hovering just above it). */
function isResting(grid: Grid, prop: PropState): boolean {
  const box = propBox(prop)
  const bottom = box.y + box.h
  return Math.abs(bottom - Math.round(bottom)) < 1e-6 && isSupported(grid, prop)
}

function footingOf(box: Rect): Rect {
  const w = Math.min(box.w, Math.max(MIN_FOOTING, box.w * FOOTING))
  return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h }
}

function fall(world: World, prop: PropState, loose: LooseProp, dt: number): void {
  const start = footingOf(propBox(prop))
  const body: Body = { ...start, vx: loose.vx, vy: loose.vy + GRAVITY * dt, onGround: false }
  const speed = body.vy
  moveBody(world.grid, body, dt)
  shiftProp(prop, body.x - start.x, body.y - start.y)
  if (speed > CRUSH_SPEED) crush(world, prop, loose, speed)
  loose.vx = body.vx
  loose.vy = body.vy
  if (body.onGround) land(world, prop, loose, speed, dt)
  rekeyIfMoved(world, prop, loose, loose.vx === 0 && loose.vy === 0)
}

function land(world: World, prop: PropState, loose: LooseProp, speed: number, dt: number): void {
  const box = propBox(prop)
  shiftProp(prop, 0, Math.round(box.y + box.h) - (box.y + box.h))
  loose.vy = 0
  loose.struck.clear()
  loose.vx *= Math.exp(-FRICTION * dt)
  if (Math.abs(loose.vx) < STOP_SPEED) loose.vx = 0
  if (speed < THUD_SPEED) return
  const center = propCenter(prop)
  playSound(world, 'impact', center)
  emitNoise(world, center, THUD_NOISE + weightOf(prop.kind) * THUD_NOISE_PER_WEIGHT)
}

/** Whoever the falling prop comes down on is hurt once per fall, harder for heavy things falling fast. */
function crush(world: World, prop: PropState, loose: LooseProp, speed: number): void {
  const box = propBox(prop)
  const damage = weightOf(prop.kind) * speed * CRUSH_DAMAGE
  const center = propCenter(prop)
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || loose.struck.has(guard) || !overlaps(guard, box)) continue
    loose.struck.add(guard)
    if (!hurtGuard(world, guard, damage, center, 'hazard')) stunGuard(guard, CRUSH_STUN)
  }
  if (!loose.struck.has(world.player) && overlaps(world.player, box)) {
    loose.struck.add(world.player)
    world.player.hp -= damage / 2
  }
}
