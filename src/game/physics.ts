import { isSolidAt, type Grid } from './tiles'
import type { Body, Rect } from './types'

export const GRAVITY = 42
const MAX_SPEED = 45
const MAX_STEP = 0.45
const EPSILON = 0.001

export function boxHitsSolid(grid: Grid, box: Rect): boolean {
  const x1 = Math.floor(box.x + box.w - EPSILON)
  const y1 = Math.floor(box.y + box.h - EPSILON)
  for (let y = Math.floor(box.y); y <= y1; y += 1) {
    for (let x = Math.floor(box.x); x <= x1; x += 1) if (isSolidAt(grid, x, y)) return true
  }
  return false
}

/** Moves a body by its velocity, stopping at solid tiles. Returns true if it was blocked sideways. */
export function moveBody(grid: Grid, body: Body, dt: number): boolean {
  body.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, body.vx))
  body.vy = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, body.vy))
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(body.vx), Math.abs(body.vy)) * dt) / MAX_STEP))
  const stepDt = dt / steps
  const wasOnGround = body.onGround
  body.onGround = false
  let blocked = false
  for (let index = 0; index < steps; index += 1) {
    if (moveX(grid, body, body.vx * stepDt, wasOnGround || body.onGround)) blocked = true
    moveY(grid, body, body.vy * stepDt)
  }
  return blocked
}

function moveX(grid: Grid, body: Body, dx: number, canStepUp: boolean): boolean {
  if (dx === 0) return false
  body.x += dx
  if (!boxHitsSolid(grid, body)) return false
  // Walk up a one-tile ledge so rubble does not stop a run.
  if (canStepUp) {
    const lifted = { ...body, y: Math.floor(body.y + body.h - EPSILON) - body.h }
    if (!boxHitsSolid(grid, lifted)) {
      body.y = lifted.y
      return false
    }
  }
  body.x = dx > 0 ? Math.floor(body.x + body.w) - body.w - EPSILON : Math.floor(body.x) + 1 + EPSILON
  body.vx = 0
  return true
}

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
