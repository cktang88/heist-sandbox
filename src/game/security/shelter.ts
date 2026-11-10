import { isSolidAt, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { zoneAt } from './killZones'
import { exposedTo } from './lineOfFire'
import { feetOf, type Guard, type Shelter } from './model'
import { isDoorway } from './places'

/**
 * Where to go when rounds are coming in. Every spot along his floor he can walk to is judged against the shooter's
 * position: does a wall, the slab overhead, a door frame, a tipped table or a cabinet take the shots there, kneeling
 * or standing? The best one is close, hides him, and has somewhere next to it to come up and fire from (`peek`).
 * With nowhere hidden in reach, he still gets out of the way: the furthest he can go from the shooter.
 */

const STEP = 0.5
/** A peek is standing up where he is, or stepping (dashing) out this far. */
const PEEK_STEPS = [0.6, 1.2, 1.8, 2.5, 3.2, 4]
/** Two guards do not share one spot. */
const SPACING = 1.2
const NO_PEEK = 3
/** A long dash out to fire is worse than standing up where he is. */
const PEEK_COST = 0.5
const STANDING_EXPOSED = 0.8
/** Hidden only by the lip of the hole the shooter is standing at: one step forward and he sees you. */
const UNDER_OPENING = 6
/** A spot must hide him from the shooter a step to either side of where he is, too. */
const SHOOTER_STEP = 1

type Candidate = { spot: Vec; offset: number }

/** The best shelter for this guard from a shooter at `threat`. `retreat` keeps only spots further from the shooter than he is. */
export function findShelter(world: World, guard: Guard, threat: Vec, reach: number, retreat: boolean): Shelter {
  const feet = feetOf(guard)
  const taken = world.guards.filter((other) => other !== guard && other.mode !== 'dead' && other.shelter).map((other) => other.shelter!)
  let best: Shelter | null = null
  let bestScore = Infinity
  for (const { spot, offset } of walkable(world, feet, reach)) {
    if (isDoorway(world, spot.x, spot.y) || zoneAt(world, spot)) continue
    if (taken.some((other) => Math.abs(other.x - spot.x) < SPACING && Math.abs(other.y - spot.y) < 1)) continue
    if (retreat && distanceAlong(spot, threat) <= distanceAlong(feet, threat)) continue
    if (exposedNearby(world, threat, spot, true)) continue
    const crouch = exposedNearby(world, threat, spot, false)
    const peek = crouch ? spot : stepOut(world, threat, spot)
    const score = offset + (peek ? Math.abs(peek.x - spot.x) * PEEK_COST : NO_PEEK) + (crouch ? STANDING_EXPOSED : 0) + (underOpening(world, spot, threat) ? UNDER_OPENING : 0)
    if (score < bestScore) {
      best = { x: spot.x, y: spot.y, hidden: true, crouch, peek, from: { ...threat }, spent: false, waits: 0 }
      bestScore = score
    }
  }
  return best ?? outOfTheWay(world, feet, threat, reach)
}

/** Exposed to the shooter where he is, or a step to either side of it? */
function exposedNearby(world: World, threat: Vec, spot: Vec, crouching: boolean): boolean {
  return [0, -SHOOTER_STEP, SHOOTER_STEP].some((step) => exposedTo(world, { x: threat.x + step, y: threat.y }, spot, crouching))
}

/** With the shooter above, is there open air over this spot up to his floor (it is under the hole he is firing through)? */
function underOpening(world: World, spot: Vec, threat: Vec): boolean {
  if (threat.y > spot.y - 3) return false
  for (let y = spot.y - 1; y > threat.y; y -= 1) if (isSolidAt(world.grid, spot.x, y)) return false
  return true
}

/** Is the shelter still good against the shooter where he is now? */
export function shelterHolds(world: World, shelter: Shelter, threat: Vec): boolean {
  return shelter.hidden && !exposedTo(world, threat, shelter, shelter.crouch)
}

/** Every half tile along his floor that he can walk to without meeting a wall or a drop, nearest first. */
function walkable(world: World, feet: Vec, reach: number): Candidate[] {
  const found: Candidate[] = [{ spot: { x: feet.x, y: feet.y }, offset: 0 }]
  for (const side of [-1, 1]) {
    for (let offset = STEP; offset <= reach; offset += STEP) {
      const spot = { x: feet.x + side * offset, y: feet.y }
      if (!passable(world, spot)) break
      found.push({ spot, offset })
    }
  }
  return found.sort((a, b) => a.offset - b.offset)
}

/** Floor underfoot and room to stand (a door counts: guards open them). */
function passable(world: World, spot: Vec): boolean {
  if (!isSolidAt(world.grid, spot.x, spot.y + 0.5)) return false
  return [0.5, 1.5].every((up) => !isSolidAt(world.grid, spot.x, spot.y - up) || tileAt(world.grid, Math.floor(spot.x), Math.floor(spot.y - up)) === 'door')
}

/** A spot right beside a hidden one where, standing, he can see and fire at the shooter. */
function stepOut(world: World, threat: Vec, spot: Vec): Vec | null {
  for (const step of PEEK_STEPS) {
    for (const side of [-1, 1]) {
      const peek = { x: spot.x + side * step, y: spot.y }
      if (passable(world, peek) && exposedTo(world, threat, peek, false)) return peek
    }
  }
  return null
}

/** Nothing hides him: the furthest he can get from the shooter along his floor. */
function outOfTheWay(world: World, feet: Vec, threat: Vec, reach: number): Shelter {
  let best = { x: feet.x, y: feet.y }
  for (const { spot } of walkable(world, feet, reach)) if (distanceAlong(spot, threat) > distanceAlong(best, threat)) best = spot
  return { ...best, hidden: false, crouch: true, peek: null, from: { ...threat }, spent: false, waits: 0 }
}

function distanceAlong(at: Vec, threat: Vec): number {
  return Math.hypot(at.x - threat.x, at.y - threat.y)
}
