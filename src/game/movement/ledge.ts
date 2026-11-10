import { boxHitsSolid } from '../physics'
import { isSolidAt, type Grid } from '../tiles'
import type { Body, Vec } from '../types'
import { CROUCH_HEIGHT, STAND_HEIGHT } from './posture'

export const MANTLE_SECONDS = 0.35
/** How close to a wall the body must be to put a hand on it. */
const REACH_GAP = 0.15
/** The ledge's top edge may be this far above the top of the head (arms overhead)... */
const REACH_ABOVE_HEAD = 0.6
/** ...down to just above the feet, where it becomes a quick vault. */
const REACH_ABOVE_FEET = 0.2
/** The vertical pull-up takes this share of the climb; the step over the edge overlaps its end. */
const RISE_SHARE = 0.6
const STEP_START = 0.4

/**
 * Pulling up over a ledge. `from` and `to` are the top-left corner of the body at the start and end;
 * `t` counts seconds since the hands caught the edge. The renderer reads it to pose the climb.
 */
export type Mantle = { from: Vec; to: Vec; t: number; duration: number; side: 1 | -1 }

/** Where the body ends up after climbing the ledge in front of it, or null if there is none to catch. */
export function findLedge(grid: Grid, body: Body, side: 1 | -1): (Vec & { h: number }) | null {
  const column = side > 0 ? Math.floor(body.x + body.w + REACH_GAP) : Math.floor(body.x - REACH_GAP)
  const feet = body.y + body.h
  for (let row = Math.ceil(body.y - REACH_ABOVE_HEAD); row <= Math.floor(feet - REACH_ABOVE_FEET); row += 1) {
    if (!isSolidAt(grid, column, row) || isSolidAt(grid, column, row - 1)) continue
    // Stand on top if there is room, otherwise squeeze in crouched (a duct or a low window).
    for (const h of [STAND_HEIGHT, CROUCH_HEIGHT]) {
      const top = row - h
      const end = { x: column + (1 - body.w) / 2, y: top, w: body.w, h }
      const rise = { x: body.x, y: top, w: body.w, h: Math.max(h, feet - top) }
      if (!boxHitsSolid(grid, end) && !boxHitsSolid(grid, rise)) return { x: end.x, y: top, h }
    }
    return null
  }
  return null
}

export function startMantle(body: Body, ledge: Vec & { h: number }, side: 1 | -1): Mantle {
  const feet = body.y + body.h
  body.h = ledge.h
  body.y = feet - ledge.h
  body.vx = 0
  body.vy = 0
  return { from: { x: body.x, y: body.y }, to: { x: ledge.x, y: ledge.y }, t: 0, duration: MANTLE_SECONDS, side }
}

/** Moves the body along the climb: up first, then over the edge. Returns true when it is done. */
export function stepMantle(body: Body, mantle: Mantle, dt: number): boolean {
  mantle.t = Math.min(mantle.duration, mantle.t + dt)
  const progress = mantle.t / mantle.duration
  const rise = Math.min(1, progress / RISE_SHARE)
  const step = Math.max(0, (progress - STEP_START) / (1 - STEP_START))
  body.x = mantle.from.x + (mantle.to.x - mantle.from.x) * step
  body.y = mantle.from.y + (mantle.to.y - mantle.from.y) * rise
  body.vx = 0
  body.vy = 0
  body.onGround = progress >= 1
  return progress >= 1
}

/** Letting go drops the body back where it caught the ledge, which is known to be clear. */
export function letGo(body: Body, mantle: Mantle): void {
  body.x = mantle.from.x
  body.y = mantle.from.y
  body.vy = 0
}
