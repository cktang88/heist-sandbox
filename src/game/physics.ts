import { blocksLaneAt, type Grid } from './tiles'
import type { Body, Rect } from './types'

export const GRAVITY = 42
const MAX_SPEED = 45
const MAX_STEP = 0.45
const EPSILON = 0.001

/**
 * True when the box overlaps a tile that blocks the walking lane. Tiles standing aside in depth (see `CLEAR_OF_LANE`
 * in tiles.ts) are passed by everything moving along the lane, though they still stop shots and sight.
 */
export function boxHitsSolid(grid: Grid, box: Rect): boolean {
  const x1 = Math.floor(box.x + box.w - EPSILON)
  const y1 = Math.floor(box.y + box.h - EPSILON)
  for (let y = Math.floor(box.y); y <= y1; y += 1) {
    for (let x = Math.floor(box.x); x <= x1; x += 1) if (blocksLaneAt(grid, x, y)) return true
  }
  return false
}

/**
 * How high a person climbs onto a ledge or heap in their way without jumping: one tile (about 1.1 m, waist high on
 * someone 1.75 m tall), the most anyone gets a knee onto while walking. Two tiles needs a jump and a ledge grab.
 * Things that are not people (furniture, a rolling grenade) do not climb at all: pass 0.
 */
export const PERSON_STEP_UP = 1

/**
 * Moves a body by its velocity, stopping at solid tiles. A body on the ground walks up a ledge of up to `stepUp`
 * whole tiles in its way (see `PERSON_STEP_UP`). Returns true if it was blocked sideways.
 */
export function moveBody(grid: Grid, body: Body, dt: number, stepUp = PERSON_STEP_UP): boolean {
  body.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, body.vx))
  body.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, body.vy))
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(body.vx), Math.abs(body.vy)) * dt) / MAX_STEP))
  const stepDt = dt / steps
  const wasOnGround = body.onGround
  body.onGround = false
  let blocked = false
  for (let index = 0; index < steps; index += 1) {
    if (moveX(grid, body, body.vx * stepDt, wasOnGround || body.onGround ? stepUp : 0)) blocked = true
    moveY(grid, body, body.vy * stepDt)
  }
  return blocked
}

const CORNER_LOOKAHEAD = 0.15
const CORNER_SHIFT_STEP = 0.05
const MAX_CORNER_SHIFT = 0.35

/**
 * A body jumping up into a ceiling that only clips its edge is slid sideways into the opening,
 * so a narrow hatch or grate does not need pixel-perfect lining up. Tries the smallest shift first.
 */
export function slipPastCorner(grid: Grid, body: Body, preferred: number): void {
  if (body.vy >= 0 || !boxHitsSolid(grid, { ...body, y: body.y - CORNER_LOOKAHEAD })) return
  const sides = preferred < 0 ? [-1, 1] : [1, -1]
  for (let shift = CORNER_SHIFT_STEP; shift <= MAX_CORNER_SHIFT + EPSILON; shift += CORNER_SHIFT_STEP) {
    for (const side of sides) {
      const x = body.x + side * shift
      if (boxHitsSolid(grid, { ...body, x }) || boxHitsSolid(grid, { ...body, x, y: body.y - CORNER_LOOKAHEAD })) continue
      body.x = x
      return
    }
  }
}

function moveX(grid: Grid, body: Body, dx: number, stepUp: number): boolean {
  if (dx === 0) return false
  body.x += dx
  if (!boxHitsSolid(grid, body)) return false
  const lifted = steppedUp(grid, body, stepUp)
  if (lifted !== null) {
    body.y = lifted
    return false
  }
  body.x = dx > 0 ? Math.floor(body.x + body.w) - body.w - EPSILON : Math.floor(body.x) + 1 + EPSILON
  body.vx = 0
  return true
}

/** The top of the body standing on whatever is in its way, if that is at most `stepUp` tiles up with room above. */
function steppedUp(grid: Grid, body: Body, stepUp: number): number | null {
  const feetRow = Math.floor(body.y + body.h - EPSILON)
  for (let rise = 1; rise <= stepUp; rise += 1) {
    const y = feetRow - (rise - 1) - body.h
    if (!boxHitsSolid(grid, { ...body, y })) return y
  }
  return null
}

/**
 * True when a person walking toward `side` would step up onto what is in front of them without a jump. Shared by
 * the player's movement (through `moveBody`) and route choices, so everyone climbs the same heaps.
 */
export function canStepUpAhead(grid: Grid, body: Body, side: 1 | -1): boolean {
  const ahead = { ...body, x: body.x + side * STEP_PROBE }
  if (!boxHitsSolid(grid, ahead)) return false
  return steppedUp(grid, ahead, PERSON_STEP_UP) !== null
}

/** How far ahead of a person `canStepUpAhead` looks. */
const STEP_PROBE = 0.3

function moveY(grid: Grid, body: Body, dy: number): void {
  if (dy === 0) return
  body.y += dy
  if (!boxHitsSolid(grid, body)) return
  if (dy > 0) {
    body.y = Math.floor(body.y + body.h) - body.h - EPSILON
    body.onGround = true
  } else {
    body.y = Math.floor(body.y) + 1 + EPSILON
  }
  body.vy = 0
}
