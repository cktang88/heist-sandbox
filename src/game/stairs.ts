import type { Stairwell } from './site'
import type { Body, Vec } from './types'

/**
 * Staircases run up the back of a stair lobby, zigzagging between a left and a right landing.
 * Someone on the stairs is out of the main walking lane: they follow the flight and ignore walls and gravity.
 * `u` counts stops from the bottom: 0 is the lowest landing, 1.5 is halfway up the second flight.
 */
export type OnStairs = { well: number; u: number }

const CLIMB_SPEED = 7.5
const LANDING_REACH_X = 0.8
const LANDING_REACH_Y = 0.5

export function landingX(well: Stairwell, stop: number): number {
  return stop % 2 === 0 ? well.leftX : well.rightX
}

/** Where someone's feet are at position `u` on a staircase. */
export function stairPoint(well: Stairwell, u: number): Vec {
  const last = well.stops.length - 1
  const clamped = Math.max(0, Math.min(last, u))
  const below = Math.min(last - 1, Math.floor(clamped))
  const along = clamped - below
  return {
    x: landingX(well, below) + (landingX(well, below + 1) - landingX(well, below)) * along,
    y: well.stops[below] + (well.stops[below + 1] - well.stops[below]) * along,
  }
}

/** The landing someone is standing at, if any. */
export function findLanding(wells: readonly Stairwell[], x: number, feetY: number): { well: Stairwell; stop: number } | null {
  for (const well of wells) {
    for (let stop = 0; stop < well.stops.length; stop += 1) {
      if (Math.abs(well.stops[stop] - feetY) > LANDING_REACH_Y) continue
      if (Math.abs(landingX(well, stop) - x) <= LANDING_REACH_X) return { well, stop }
    }
  }
  return null
}

/**
 * Moves along the stairs: `direction` is +1 up, -1 down. Returns false once a landing is reached
 * and the climber should step back onto the floor. Passing `keepGoing` carries on through landings.
 */
export function climbStairs(body: Body, on: OnStairs, well: Stairwell, direction: number, keepGoing: boolean, dt: number): boolean {
  const last = well.stops.length - 1
  const flight = Math.max(0, Math.min(last - 1, direction > 0 ? Math.floor(on.u) : Math.ceil(on.u) - 1))
  const length = Math.hypot(landingX(well, flight + 1) - landingX(well, flight), well.stops[flight + 1] - well.stops[flight])
  const before = on.u
  on.u = Math.max(0, Math.min(last, on.u + (direction * CLIMB_SPEED * dt) / length))
  const reached = direction > 0 ? Math.floor(on.u) > Math.floor(before) || on.u === last : Math.ceil(on.u) < Math.ceil(before) || on.u === 0
  if (reached && (!keepGoing || on.u === 0 || on.u === last)) on.u = Math.round(on.u)
  const feet = stairPoint(well, on.u)
  body.x = feet.x - body.w / 2
  body.y = feet.y - body.h
  body.vx = 0
  body.vy = 0
  body.onGround = true
  return !(reached && Number.isInteger(on.u))
}
