import type { Input } from '../input'
import { findLedge, startMantle } from '../movement/ledge'
import { STAND_HEIGHT } from '../movement/posture'
import { boxHitsSolid, GRAVITY, moveBody } from '../physics'
import type { Player } from '../player'
import { isSolidAt, type Grid } from '../tiles'
import { distance, type Vec } from '../types'
import type { GrappleState } from './state'

/** Reeling in beats a ladder (6.5 tiles a second) so the line is a real way up, but it still takes a few seconds. */
export const REEL_IN_SPEED = 9
const PAY_OUT_SPEED = 10
export const MIN_LINE = 1
export const MAX_LINE = 34
/** A to D pumps the swing. With the damping this stays a short, firm arc rather than a floaty one. */
const SWING_ACCEL = 16
const SWING_DAMPING = 0.7
/** Space throws him off the line with a little hop on top of the swing. */
const JUMP_OFF_HOP = 6
/** How long a jump off the line keeps its swing before the normal air control takes over again. */
export const FLING_SECONDS = 0.7
/** Falling faster than this is no longer a swing: the ordinary fall (with its parachute) takes over. */
const FLING_FALL_LIMIT = 12
/** The same hard-landing rule the player's own movement uses. */
const SAFE_FALL_SPEED = 24
const FALL_DAMAGE_PER_SPEED = 6
const SAMPLE = 0.1
const ARM_LIFTS = [0, 0.5, 1, 1.5, 2]
/** A bend sits this far off the corner it wraps, so the line never runs through the tile. */
const CORNER_STANDOFF = 0.06

/** Where the line meets the player: his hands, held up over his head. */
export function gripOf(player: Player): Vec {
  return { x: player.x + player.w / 2, y: player.y + 0.15 }
}

/** The point the line pulls toward: the bend if it is wrapped round a corner, otherwise the hook. */
export function pivotOf(grapple: GrappleState): Vec {
  return grapple.bend ?? grapple.hook
}

/** Line left between the pivot and the hands. */
function freeLength(grapple: GrappleState): number {
  return grapple.bend ? grapple.length - distance(grapple.hook, grapple.bend) : grapple.length
}

/** True when nothing solid lies on the straight line between two points (the tile the hook bit does not count). */
export function clearBetween(grid: Grid, a: Vec, b: Vec, anchor: Vec | null): boolean {
  const gap = distance(a, b)
  for (let travelled = SAMPLE; travelled < gap - SAMPLE; travelled += SAMPLE) {
    const x = Math.floor(a.x + ((b.x - a.x) * travelled) / gap)
    const y = Math.floor(a.y + ((b.y - a.y) * travelled) / gap)
    if (anchor && x === anchor.x && y === anchor.y) continue
    if (isSolidAt(grid, x, y)) return false
  }
  return true
}

/**
 * Keeps the line out of walls in the simplest way that works: when a wall gets between the hands and the hook, the
 * line catches on the nearest corner of the tile in the way (one bend at most); when the way is clear again it
 * straightens. With no corner to catch on (or a second wall in the way) the line stays as it was and the pull stops
 * at the wall, since the body cannot be pulled through it.
 */
export function wrapLine(grid: Grid, grapple: GrappleState, grip: Vec): void {
  if (grapple.bend && clearBetween(grid, grapple.hook, grip, grapple.anchor)) grapple.bend = null
  const pivot = pivotOf(grapple)
  if (grapple.bend || clearBetween(grid, pivot, grip, grapple.anchor)) return
  const blocker = firstSolid(grid, pivot, grip, grapple.anchor)
  if (!blocker) return
  let best: Vec | null = null
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const corner = {
      x: blocker.x + dx + (dx === 0 ? -CORNER_STANDOFF : CORNER_STANDOFF),
      y: blocker.y + dy + (dy === 0 ? -CORNER_STANDOFF : CORNER_STANDOFF),
    }
    if (isSolidAt(grid, corner.x, corner.y) || !clearBetween(grid, pivot, corner, grapple.anchor) || !clearBetween(grid, corner, grip, grapple.anchor)) continue
    if (!best || distance(pivot, corner) + distance(corner, grip) < distance(pivot, best) + distance(best, grip)) best = corner
  }
  if (best) grapple.bend = best
}

function firstSolid(grid: Grid, a: Vec, b: Vec, anchor: Vec | null): Vec | null {
  const gap = distance(a, b)
  for (let travelled = SAMPLE; travelled < gap; travelled += SAMPLE) {
    const x = Math.floor(a.x + ((b.x - a.x) * travelled) / gap)
    const y = Math.floor(a.y + ((b.y - a.y) * travelled) / gap)
    if (anchor && x === anchor.x && y === anchor.y) continue
    if (isSolidAt(grid, x, y)) return { x, y }
  }
  return null
}

/**
 * Decides whether the line carries him this frame. A slack line leaves him to walk, jump and fall on his own; it
 * takes his weight once he reaches its end in the air, or as soon as he reels it in tighter than he stands.
 */
export function takesWeight(player: Player, grapple: GrappleState, input: Input): boolean {
  const reach = distance(gripOf(player), pivotOf(grapple))
  if (input.up && reach > MIN_LINE) grapple.length = Math.min(grapple.length, reach + (grapple.length - freeLength(grapple)))
  const taut = reach >= freeLength(grapple) - 0.02
  if (grapple.hanging) return !(player.onGround && !taut)
  return (taut && !player.onGround) || (input.up && taut)
}

/**
 * One frame on the line: gravity, the swing, reeling, then the line pulls him back onto its circle. Space jumps off
 * keeping the swing; pushing up at the top of the line beside a ledge climbs onto it. Returns 'jumped' or 'climbed'
 * when he leaves the line, otherwise 'hanging'.
 */
export function swing(grid: Grid, player: Player, grapple: GrappleState, input: Input, dt: number): 'hanging' | 'jumped' | 'climbed' {
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const vel = grapple.vel
  grapple.reeling = input.up ? 1 : input.down ? -1 : 0
  if (input.up) grapple.length = Math.max(MIN_LINE + (grapple.length - freeLength(grapple)), grapple.length - REEL_IN_SPEED * dt)
  else if (input.down) grapple.length = Math.min(MAX_LINE, grapple.length + PAY_OUT_SPEED * dt)

  if (input.jumpPressed) {
    vel.y = Math.min(vel.y, 0) - JUMP_OFF_HOP
    return 'jumped'
  }
  if (input.up && freeLength(grapple) <= MIN_LINE + 0.05 && climbOnto(grid, player, grapple)) return 'climbed'

  vel.y += GRAVITY * dt
  vel.x += move * SWING_ACCEL * dt
  const damping = Math.exp(-SWING_DAMPING * dt)
  vel.x *= damping
  vel.y *= damping
  travel(grid, player, grapple, dt)
  pullTaut(grid, player, grapple)
  return 'hanging'
}

/**
 * Moves the body by the line's velocity through the tiles, taking a hard landing like the player's own movement does.
 * Keeps the velocity from before any wall or pane stopped it, for a crash through glass to read.
 */
export function travel(grid: Grid, player: Player, grapple: GrappleState, dt: number): void {
  const vel = grapple.vel
  grapple.lastVel = { ...vel }
  player.vx = vel.x
  player.vy = vel.y
  moveBody(grid, player, dt)
  if (player.onGround && grapple.lastVel.y > SAFE_FALL_SPEED) player.hp -= (grapple.lastVel.y - SAFE_FALL_SPEED) * FALL_DAMAGE_PER_SPEED
  vel.x = player.vx
  vel.y = player.vy
}

/** Puts the hands back on the line's circle and takes away any speed carrying him outward. */
function pullTaut(grid: Grid, player: Player, grapple: GrappleState): void {
  const pivot = pivotOf(grapple)
  const grip = gripOf(player)
  const gap = distance(grip, pivot)
  const free = freeLength(grapple)
  if (gap <= free || gap < 1e-6) return
  const out = { x: (grip.x - pivot.x) / gap, y: (grip.y - pivot.y) / gap }
  const over = gap - free
  shove(grid, player, -out.x * over, -out.y * over)
  const outward = grapple.vel.x * out.x + grapple.vel.y * out.y
  if (outward > 0) {
    grapple.vel.x -= outward * out.x
    grapple.vel.y -= outward * out.y
  }
}

/** Moves the body by a small offset, stopping at walls as walking would. */
function shove(grid: Grid, player: Player, dx: number, dy: number): void {
  const { vx, vy, onGround } = player
  player.vx = dx
  player.vy = dy
  moveBody(grid, player, 1)
  Object.assign(player, { vx, vy, onGround: onGround || player.onGround })
}

/**
 * At the top of the line, beside the edge it bit: pull up over it, exactly as a ledge is climbed. His hands are on the
 * hook, so the edge may be up to an arm's length above where the ledge climb would normally reach.
 */
function climbOnto(grid: Grid, player: Player, grapple: GrappleState): boolean {
  const side: 1 | -1 = pivotOf(grapple).x >= player.x + player.w / 2 ? 1 : -1
  for (const lift of ARM_LIFTS) {
    const lifted = { ...player, y: player.y - lift }
    if (boxHitsSolid(grid, lifted)) return false
    for (const facing of [side, -side as 1 | -1]) {
      const ledge = findLedge(grid, lifted, facing)
      if (!ledge) continue
      player.y = lifted.y
      player.mantle = startMantle(player, ledge, facing)
      player.crouching = ledge.h < STAND_HEIGHT
      return true
    }
  }
  return false
}

/**
 * The last moments of a jump off the line: the swing carries him (gravity, no air brake) until he lands, grabs
 * something, hits a wall or the moment passes. Returns false once it is over.
 */
export function carryFling(grid: Grid, player: Player, grapple: GrappleState, dt: number): boolean {
  grapple.fling = Math.max(0, grapple.fling - dt)
  grapple.vel.y += GRAVITY * dt
  travel(grid, player, grapple, dt)
  return grapple.fling > 0 && !player.onGround && grapple.vel.x !== 0 && grapple.vel.y < FLING_FALL_LIMIT
}
