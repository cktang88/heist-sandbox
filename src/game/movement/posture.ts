import { boxHitsSolid } from '../physics'
import type { Grid } from '../tiles'
import type { Body } from '../types'

export const STAND_HEIGHT = 1.6
export const CROUCH_HEIGHT = 0.9
export const SLIDE_SECONDS = 0.6
/** A slide needs a proper run-up; anything slower just crouches. */
const SLIDE_MIN_SPEED = 7
const SLIDE_BOOST = 1.25
/** Chosen so a slide bleeds off to crawling pace by the time it ends. */
const SLIDE_DECELERATION = 12
const SLIDE_STOPPED_SPEED = 0.5

/** The parts of the player that decide how tall it stands. */
export type Posture = Body & {
  crouching: boolean
  /** Seconds left of a slide, or 0. */
  slide: number
  crouchWasHeld: boolean
}

/** Changes height while keeping the feet where they are. */
export function setHeight(body: Body, height: number): void {
  body.y += body.h - height
  body.h = height
}

export function hasHeadroom(grid: Grid, body: Body, height = STAND_HEIGHT): boolean {
  return !boxHitsSolid(grid, { x: body.x, y: body.y + body.h - height, w: body.w, h: height })
}

/**
 * Decides between standing, crouching and sliding for this frame. Crouching starts only on the ground,
 * a crouch pressed at a run turns into a slide, and nobody stands up into a ceiling.
 */
export function updatePosture(grid: Grid, body: Posture, crouchHeld: boolean, runSpeed: number, dt: number): void {
  const pressed = crouchHeld && !body.crouchWasHeld
  body.crouchWasHeld = crouchHeld
  if (body.slide > 0) {
    body.slide = body.onGround && Math.abs(body.vx) > SLIDE_STOPPED_SPEED ? Math.max(0, body.slide - dt) : 0
  } else if (pressed && body.onGround && !body.crouching && Math.abs(body.vx) >= SLIDE_MIN_SPEED) {
    body.slide = SLIDE_SECONDS
    body.vx = Math.sign(body.vx) * Math.max(Math.abs(body.vx), runSpeed) * SLIDE_BOOST
  }
  const low = body.slide > 0 || (crouchHeld && (body.onGround || body.crouching))
  body.crouching = low || (body.crouching && !hasHeadroom(grid, body))
  setHeight(body, body.crouching ? CROUCH_HEIGHT : STAND_HEIGHT)
}

/** A slide coasts on its own momentum and slows down to `floorSpeed`. */
export function slideVelocity(vx: number, floorSpeed: number, dt: number): number {
  return Math.sign(vx) * Math.max(floorSpeed, Math.abs(vx) - SLIDE_DECELERATION * dt)
}
