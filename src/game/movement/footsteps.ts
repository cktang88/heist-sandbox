import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import type { Body, Vec } from '../types'
import type { World } from '../world'

/** A sound the player's feet made this frame. `hard` marks a heavy landing. */
export type Footfall = Vec & { radius: number; hard: boolean }

/** Tiles covered per footfall at a run. */
const STRIDE = 2.2
const STEP_RADIUS = 4
/** Landing faster than this (a drop of about 3.5 tiles) is loud. A plain jump lands at about 15.5. */
const HARD_LANDING_SPEED = 17
const LANDING_RADIUS = 8
const LANDING_RADIUS_PER_SPEED = 0.4
const MAX_LANDING_RADIUS = 14
/** Footfalls wait here until the step emits them; the cap keeps a stalled queue from growing. */
const MAX_PENDING = 8

export type Feet = Body & { crouching: boolean; stride: number; footfalls: Footfall[] }

function feetOf(body: Body): Vec {
  return { x: body.x + body.w / 2, y: body.y + body.h }
}

function record(feet: Feet, footfall: Footfall): void {
  if (feet.footfalls.length >= MAX_PENDING) feet.footfalls.shift()
  feet.footfalls.push(footfall)
}

/** Counts distance run on the ground and drops a footfall every stride. Crouching is silent. */
export function trackStride(feet: Feet, moved: number): void {
  if (!feet.onGround || feet.crouching) {
    feet.stride = 0
    return
  }
  feet.stride += Math.abs(moved)
  if (feet.stride < STRIDE) return
  feet.stride -= STRIDE
  record(feet, { ...feetOf(feet), radius: STEP_RADIUS, hard: false })
}

export function trackLanding(feet: Feet, fallSpeed: number): void {
  if (fallSpeed <= HARD_LANDING_SPEED) return
  const radius = Math.min(MAX_LANDING_RADIUS, LANDING_RADIUS + (fallSpeed - HARD_LANDING_SPEED) * LANDING_RADIUS_PER_SPEED)
  record(feet, { ...feetOf(feet), radius, hard: true })
}

/** Lets guards hear, and the speakers play, what the player's feet did since the last call. */
export function emitMovementNoise(world: World): void {
  for (const footfall of world.player.footfalls) {
    emitNoise(world, footfall, footfall.radius)
    playSound(world, footfall.hard ? 'impact' : 'footstep', footfall)
  }
  world.player.footfalls.length = 0
}
