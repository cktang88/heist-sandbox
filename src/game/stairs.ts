import { burst } from './effects'
import type { Stairwell } from './site'
import { playSound } from './sounds'
import type { Body, Vec } from './types'
import type { World } from './world'

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

/**
 * A staircase with flight `flight` (from stop `flight` to the next) gone, as the pieces still standing.
 * The upper piece keeps its landings where they were: if it starts on a right-hand landing, its sides swap so stop 0
 * is still the left field. A piece of a single landing is no staircase and is dropped.
 * The lower piece keeps the old id, so anyone on it carries on; the upper piece takes `newId`.
 */
export function splitWell(well: Stairwell, flight: number, newId: number): Stairwell[] {
  const lower: Stairwell = { ...well, stops: well.stops.slice(0, flight + 1) }
  const startsRight = (flight + 1) % 2 === 1
  const upper: Stairwell = {
    ...well, id: newId, stops: well.stops.slice(flight + 1),
    leftX: startsRight ? well.rightX : well.leftX, rightX: startsRight ? well.leftX : well.rightX,
  }
  return [lower, upper].filter((piece) => piece.stops.length >= 2)
}

/** How far a point is from a flight's line, from one landing to the next. */
export function distanceToFlight(well: Stairwell, flight: number, at: Vec): number {
  const a = stairPoint(well, flight)
  const b = stairPoint(well, flight + 1)
  const dx = b.x - a.x
  const dy = b.y - a.y
  const t = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / (dx * dx + dy * dy || 1)))
  return Math.hypot(at.x - (a.x + dx * t), at.y - (a.y + dy * t))
}

/** A flight this close to a blast, as a share of its radius, is blown away. The reinforced core around it stays. */
const FLIGHT_BREAK_SHARE = 0.6

/** Blows away every flight close enough to an explosion. Staircases are split where a flight is gone. */
export function blastStairs(world: World, at: Vec, radius: number): void {
  for (const well of world.stairwells.slice()) {
    // Highest first: the lower piece keeps the well's id and stop numbers, so the next break still finds them.
    for (let flight = well.stops.length - 2; flight >= 0; flight -= 1) {
      if (distanceToFlight(well, flight, at) <= radius * FLIGHT_BREAK_SHARE) breakFlight(world, well.id, flight)
    }
  }
}

/**
 * Destroys one flight. Anyone on it falls; anyone higher up the same staircase is moved onto the upper piece.
 * The list of staircases is replaced, not changed in place, so whoever drew the old one can tell.
 */
export function breakFlight(world: World, wellId: number, flight: number): void {
  const well = world.stairwells.find((candidate) => candidate.id === wellId)
  if (!well || flight < 0 || flight >= well.stops.length - 1) return
  const newId = Math.max(...world.stairwells.map((other) => other.id)) + 1
  const pieces = splitWell(well, flight, newId)
  const keeps = (id: number) => pieces.some((piece) => piece.id === id)
  for (const body of [world.player, ...world.guards]) {
    const on = body.stairs
    if (!on || on.well !== wellId) continue
    if (on.u > flight && on.u < flight + 1) {
      body.stairs = null
      body.onGround = false
    } else if (on.u >= flight + 1) body.stairs = keeps(newId) ? { well: newId, u: on.u - flight - 1 } : null
    else if (!keeps(wellId)) body.stairs = null
  }
  world.stairwells = world.stairwells.flatMap((other) => (other === well ? pieces : [other]))
  for (let step = 0; step <= 4; step += 1) {
    burst(world.effects, world.rng, stairPoint(well, flight + step / 4), 5, '#8d9199', 7)
  }
  playSound(world, 'collapse', stairPoint(well, flight + 0.5))
}
