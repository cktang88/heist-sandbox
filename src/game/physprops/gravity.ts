import type { PropState } from '../cover'
import { hurtGuard, stunGuard } from '../guards'
import { propBox, propCenter } from '../hazards/props'
import { emitNoise } from '../noise'
import { boxHitsSolid, GRAVITY, moveBody } from '../physics'
import { playSound } from '../sounds'
import { backStripAt } from '../gaps/gaps'
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
    if (onBackStrip(world, prop, loose)) {
      glide(world, prop, loose, dt)
      continue
    }
    if (loose.vx === 0 && loose.vy === 0 && (isResting(world.grid, prop) || restsOnRim(world.grid, prop))) continue
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

/**
 * Standing on a floor with a walk-past hole under part of it: furniture stands at the back of the room (z -2.2 to
 * -0.6), on the strip of slab a hole in the front leaves, so it stays up, and slides along that strip when shoved,
 * unless it was pushed in on purpose (`dropping`). Every column under its footing must be floor or such a hole.
 */
export function onBackStrip(world: World, prop: PropState, loose?: LooseProp): boolean {
  if (loose?.dropping) return false
  const footing = footingOf(propBox(prop))
  const bottom = footing.y + footing.h
  const row = Math.round(bottom)
  if (Math.abs(bottom - row) > 1e-6) return false
  let overHole = false
  for (let x = Math.floor(footing.x); x <= Math.floor(footing.x + footing.w - 0.001); x += 1) {
    if (isSolidAt(world.grid, x, row)) continue
    if (!backStripAt(world, x, row)) return false
    overHole = true
  }
  return overHole
}

/** A shoved prop sliding along the back strip past a hole: it keeps to the floor's level and slows to a stop. */
function glide(world: World, prop: PropState, loose: LooseProp, dt: number): void {
  if (loose.vx === 0) {
    loose.vy = 0
    return
  }
  const dx = loose.vx * dt
  if (boxHitsSolid(world.grid, offset(propBox(prop), dx, 0))) loose.vx = 0
  else shiftProp(prop, dx, 0)
  loose.vy = 0
  loose.vx *= Math.exp(-FRICTION * dt)
  if (Math.abs(loose.vx) < STOP_SPEED) loose.vx = 0
  rekeyIfMoved(world, prop, loose, loose.vx === 0)
}

/** Standing still on a floor: supported, with its bottom right on the floor's surface (not hovering just above it). */
function isResting(grid: Grid, prop: PropState): boolean {
  const box = propBox(prop)
  const bottom = box.y + box.h
  return Math.abs(bottom - Math.round(bottom)) < 1e-6 && isSupported(grid, prop)
}

/** Lying across a gap too narrow for it, its own edges on the rim. */
function restsOnRim(grid: Grid, prop: PropState): boolean {
  const box = propBox(prop)
  const bottom = box.y + box.h
  return Math.abs(bottom - Math.round(bottom)) < 1e-6 && !boxHitsSolid(grid, box) && boxHitsSolid(grid, offset(box, 0, RIM_PROBE))
    && slideToFit(grid, box, 0, RIM_PROBE) === null
}

function footingOf(box: Rect): Rect {
  const w = Math.min(box.w, Math.max(MIN_FOOTING, box.w * FOOTING))
  return { x: box.x + (box.w - w) / 2, y: box.y, w, h: box.h }
}

function fall(world: World, prop: PropState, loose: LooseProp, dt: number): void {
  const start = footingOf(propBox(prop))
  const body: Body = { ...start, vx: loose.vx, vy: loose.vy + GRAVITY * dt, onGround: false }
  const speed = body.vy
  // Furniture does not climb: a shove into a step stops it there.
  moveBody(world.grid, body, dt, 0)
  const box = propBox(prop)
  let dy = body.y - start.y
  let dx = body.x - start.x
  // Only the footing is moved through the grid. Unless the prop is already caught in something, its own sides,
  // wider than the footing, stop a slide at a wall, and its edges tip it into a hole it overhangs (sliding over
  // so it fits) or catch it on the rim of a gap too narrow for it.
  if (!boxHitsSolid(world.grid, box)) {
    if (dx !== 0 && boxHitsSolid(world.grid, offset(box, dx, 0))) {
      dx = 0
      body.vx = 0
    }
    if (dy > 0 && boxHitsSolid(world.grid, offset(box, dx, dy))) {
      const slide = slideToFit(world.grid, box, dx, dy)
      if (slide !== null) dx += slide
      else {
        const rim = Math.floor(box.y + box.h + dy) - (box.y + box.h)
        dy = rim > 0 && !boxHitsSolid(world.grid, offset(box, dx, rim)) ? rim : 0
        body.vy = 0
        body.onGround = true
      }
    }
  }
  shiftProp(prop, dx, dy)
  if (speed > CRUSH_SPEED) crush(world, prop, loose, speed)
  loose.vx = body.vx
  loose.vy = body.vy
  if (body.onGround) land(world, prop, loose, speed, dt)
  rekeyIfMoved(world, prop, loose, loose.vx === 0 && loose.vy === 0)
}

function land(world: World, prop: PropState, loose: LooseProp, speed: number, dt: number): void {
  const box = propBox(prop)
  shiftProp(prop, 0, Math.round(box.y + box.h) - (box.y + box.h))
  standClear(world.grid, prop)
  loose.vy = 0
  loose.dropping = false
  loose.struck.clear()
  loose.vx *= Math.exp(-FRICTION * dt)
  if (Math.abs(loose.vx) < STOP_SPEED) loose.vx = 0
  if (speed < THUD_SPEED) return
  const center = propCenter(prop)
  playSound(world, 'impact', center)
  emitNoise(world, center, THUD_NOISE + weightOf(prop.kind) * THUD_NOISE_PER_WEIGHT)
}

function offset(box: Rect, dx: number, dy: number): Rect {
  return { ...box, x: box.x + dx, y: box.y + dy }
}

const NUDGE_STEP = 0.05
const RIM_PROBE = 0.05

/** The smallest sideways shift, up to half the prop's width, that lets it drop by `dy` without touching anything. */
function slideToFit(grid: Grid, box: Rect, dx: number, dy: number): number | null {
  for (let nudge = NUDGE_STEP; nudge <= box.w / 2; nudge += NUDGE_STEP) {
    for (const side of [-1, 1]) {
      const shifted = offset(box, dx + side * nudge, 0)
      if (!boxHitsSolid(grid, shifted) && !boxHitsSolid(grid, offset(shifted, 0, dy))) return side * nudge
    }
  }
  return null
}

/**
 * A prop that dropped through a hole narrower than itself (only its footing has to fit) lands with an edge in the
 * floor it fell through or a wall beside it. It shifts sideways, as little as it can, to stand clear.
 */
function standClear(grid: Grid, prop: PropState): void {
  const box = propBox(prop)
  if (!boxHitsSolid(grid, box)) return
  for (let nudge = NUDGE_STEP; nudge <= box.w; nudge += NUDGE_STEP) {
    for (const side of [-1, 1]) {
      if (boxHitsSolid(grid, offset(box, side * nudge, 0))) continue
      shiftProp(prop, side * nudge, 0)
      return
    }
  }
  // Too wide for the gap it dropped into: it rests across the rim instead.
  for (let lift = 1; lift <= Math.ceil(box.h); lift += 1) {
    if (boxHitsSolid(grid, offset(box, 0, -lift))) continue
    shiftProp(prop, 0, -lift)
    return
  }
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
