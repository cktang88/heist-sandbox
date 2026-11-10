import { doorBlockedAt } from '../physprops/physprops'
import type { Stairwell } from '../site'
import { landingX } from '../stairs'
import { tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { barkLine } from './barks'
import { fireAt } from './combat'
import { feetOf, isActive, type DoorPlan, type Guard } from './model'
import { goTo } from './movement'
import { floorBelow, sameFloor } from './places'
import { log } from './report'
import { sendShieldTeam } from './shieldTeam'
import { PATROL, SHIELD } from './tuning'

/**
 * A door held shut by furniture shoved against it (physprops/doors.ts). Instead of putting his shoulder to every one,
 * a guard weighs it once: go round by other stairs when that is not much longer; otherwise shove it. In a fight a man
 * with a rifle shoots through it instead (at the intruder if he is behind it, or the door itself until it gives), and
 * anyone else calls for a breach: the nearest heavy, or the shield team.
 */

/**
 * Going round may cost this many times the straight walk, plus about what shoving the door in would take (a few seconds
 * of banging, in tiles he could have run instead), and still be the better choice.
 */
const AROUND_FACTOR = 1.6
const AROUND_SLACK = 24
/** What a staircase flight costs in tiles of walking (as nav.ts counts it). */
const FLIGHT_COST = 8
/** A plan for one door is forgotten after this long, or once he is past it. */
const PLAN_SECONDS = 40
/** A man on the far side this close is worth firing at through the door. */
const THROUGH_REACH = 22
/** A heavy within this distance answers a call to breach. */
const BREACH_CALL_REACH = 40

export function doorKey(door: Vec): string {
  return `${door.x},${door.y}`
}

/**
 * He has walked into a door that will not open. Returns his plan for it, deciding the first time. `goal` is where he is
 * trying to get to (a feet position).
 */
export function planForDoor(world: World, guard: Guard, door: Vec, goal: Vec): DoorPlan {
  const key = doorKey(door)
  const known = guard.doorPlan
  if (known && known.key === key && world.clock - known.since < PLAN_SECONDS) return known
  const plan = weigh(world, guard, door, goal)
  guard.doorPlan = plan
  if (plan.choice === 'around') barkLine(world, guard, 'goRound', true)
  else if (plan.choice === 'breach' && !guard.armored) callForBreach(world, guard, door)
  return plan
}

function weigh(world: World, guard: Guard, door: Vec, goal: Vec): DoorPlan {
  const feet = feetOf(guard)
  const floorY = Math.round(feet.y)
  const side = Math.sign(goal.x - door.x - 0.5) || 1
  const base = { key: doorKey(door), door: { ...door }, floorY, side, since: world.clock, waypoints: [] as Vec[], index: 0 }
  const around = routeAround(world.stairwells, feet, door.x + 0.5, goal)
  if (around && around.cost <= Math.abs(goal.x - feet.x) * AROUND_FACTOR + AROUND_SLACK) return { ...base, choice: 'around', waypoints: around.waypoints }
  return { ...base, choice: guard.mode === 'combat' ? 'breach' : 'shove' }
}

/**
 * The cheapest way round a door at column `doorX` by another floor: to a staircase on this side, along the floor above
 * or below, and back by a staircase beyond the door. Null when the stairs do not allow it.
 */
function routeAround(wells: readonly Stairwell[], feet: Vec, doorX: number, goal: Vec): { cost: number; waypoints: Vec[] } | null {
  const here = Math.sign(feet.x - doorX)
  let best: { cost: number; waypoints: Vec[] } | null = null
  for (const near of landingsOn(wells, feet.y)) {
    if (Math.sign(near.x - doorX) !== here) continue
    for (const far of landingsOn(wells, feet.y)) {
      if (far.well === near.well || Math.sign(far.x - doorX) === here) continue
      for (const step of [-1, 1]) {
        const a = near.stop + step
        const b = far.well.stops.findIndex((y) => Math.abs(y - near.well.stops[a]) < 0.5)
        if (a < 0 || a >= near.well.stops.length || b < 0 || Math.abs(b - far.stop) !== 1) continue
        const up = { x: landingX(near.well, a), y: near.well.stops[a] }
        const across = { x: landingX(far.well, b), y: far.well.stops[b] }
        const cost = Math.abs(near.x - feet.x) + FLIGHT_COST + Math.abs(across.x - up.x) + FLIGHT_COST + Math.abs(goal.x - far.x)
        if (!best || cost < best.cost) best = { cost, waypoints: [{ x: near.x, y: feet.y }, up, across, { x: far.x, y: feet.y }] }
      }
    }
  }
  return best
}

function landingsOn(wells: readonly Stairwell[], floorY: number): { well: Stairwell; stop: number; x: number }[] {
  return wells.flatMap((well) => {
    const stop = well.stops.findIndex((y) => Math.abs(y - floorY) < 0.5)
    return stop < 0 ? [] : [{ well, stop, x: landingX(well, stop) }]
  })
}

/**
 * Where to walk instead of `goal` while going round a blocked door: the next waypoint of his plan, or null when he has
 * no such plan, is past it, or is no longer heading beyond the door.
 */
export function detourStep(world: World, guard: Guard, goal: Vec): Vec | null {
  const plan = guard.doorPlan
  if (!plan || plan.choice !== 'around') return null
  const stillBeyond = Math.abs(goal.y - plan.floorY) < 1.5 && Math.sign(goal.x - plan.door.x - 0.5) === plan.side
  if (!stillBeyond || plan.index >= plan.waypoints.length || world.clock - plan.since > PLAN_SECONDS) {
    guard.doorPlan = null
    return null
  }
  return plan.waypoints[plan.index]
}

/**
 * Is the door he has walked into held shut for him? Weighs it the first time (a frame of trying it, which bangs), then
 * acts on his plan: shove it, or, as a rifleman in a fight, shoot through it. Returns true while he cannot get through.
 */
export function doorHeld(world: World, guard: Guard, door: Vec, goal: Vec): boolean {
  const plan = guard.doorPlan?.key === doorKey(door) ? guard.doorPlan : null
  if (!plan) {
    if (!doorBlockedAt(world, door)) return false
    planForDoor(world, guard, door, goal)
    return true
  }
  if (plan.choice === 'breach' && guard.armored) {
    shootThroughDoor(world, guard, door)
    return true
  }
  // Going round: he only stands here until the detour takes him away.
  return plan.choice === 'around' || doorBlockedAt(world, door)
}

/**
 * A heavy sent to breach a barricaded door goes to it (meeting it, he shoots through it). Returns true while he is on
 * his way or at it; the order lapses once the door is gone.
 */
export function goBreach(world: World, guard: Guard, dt: number): boolean {
  const door = guard.breachAt
  if (!door) return false
  if (tileAt(world.grid, door.x, door.y) !== 'door') {
    guard.breachAt = null
    return false
  }
  const feet = feetOf(guard)
  const side = Math.sign(door.x + 0.5 - feet.x) || 1
  const floorY = floorBelow(world, { x: door.x + 0.5, y: door.y }).y
  goTo(world, guard, { x: door.x + 0.5 + side * 3, y: floorY }, PATROL.runSpeed, dt, false)
  return true
}

/** He reached the waypoint he was walking to. */
export function reachedDetourStep(guard: Guard): void {
  if (guard.doorPlan) guard.doorPlan.index += 1
}

/**
 * A rifleman in a fight at a door he cannot open: rounds through it at the intruder if he is just beyond, otherwise into
 * the door itself, which gives way after enough of them (then the furniture no longer holds anything).
 */
export function shootThroughDoor(world: World, guard: Guard, door: Vec): void {
  const known = guard.lastKnown
  const feet = feetOf(guard)
  const beyond = known && sameFloor(feet, { x: known.x, y: Math.round(feet.y) }) && Math.abs(known.y - feet.y) < 3
    && Math.sign(known.x - door.x - 0.5) === Math.sign(door.x + 0.5 - feet.x) && Math.abs(known.x - feet.x) < THROUGH_REACH
  const at = beyond && known ? known : { x: door.x + 0.5, y: door.y + 0.5 }
  if (fireAt(world, guard, at)) barkLine(world, guard, 'breaching')
}

/** A man without a rifle calls the breach in: the nearest heavy is sent to the door, or else the shield team. */
function callForBreach(world: World, guard: Guard, door: Vec): void {
  barkLine(world, guard, 'callBreach', true)
  const at = { x: door.x + 0.5, y: door.y }
  const heavy = world.guards
    .filter((other) => other !== guard && other.armored && isActive(other) && other.mode === 'combat' && other.stackLeader === null && other.breachAt === null
      && Math.abs(other.x - at.x) + Math.abs(other.y - at.y) < BREACH_CALL_REACH)
    .sort((a, b) => Math.abs(a.x - at.x) + Math.abs(a.y - at.y) - (Math.abs(b.x - at.x) + Math.abs(b.y - at.y)))[0]
  if (heavy) {
    heavy.breachAt = { x: door.x, y: door.y }
    log(world, 'Control: Heavy to the barricaded door, breach it.')
    return
  }
  const security = world.security
  if (security.shieldTeams < SHIELD.maxTeams && world.clock - security.shieldTeamAt >= SHIELD.every) sendShieldTeam(world, guard.lastKnown ?? at)
}
