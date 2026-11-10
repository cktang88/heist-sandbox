import type { Vec } from '../types'
import type { World } from '../world'
import { barkLine } from './barks'
import { feetOf, isActive, setMode, type Guard } from './model'
import { buildingAt, travelCost } from './places'
import { planSearch } from './search'
import { TIERS } from './tuning'

/**
 * Orders from the control room: who goes where. Patrols are sent before posts, and operators and
 * sentries never leave their positions. Guards go in pairs: a leader and a follower who covers him.
 */

const POST_RELUCTANCE = 25
const OTHER_BUILDING = 80
const CONTACT_SEARCHERS = 6
const CONTACT_REACH = 60

export function isFree(guard: Guard): boolean {
  return isActive(guard) && (guard.mode === 'calm' || guard.mode === 'caution') && !guard.radio && guard.role !== 'operator' && guard.role !== 'sentry'
}

/** The free guards closest to a spot, by walking cost, patrols first. */
export function nearestFree(world: World, at: Vec, count: number, reach = Infinity): Guard[] {
  const building = buildingAt(world, at)
  return world.guards
    .filter(isFree)
    .map((guard) => {
      const feet = feetOf(guard)
      const cost = travelCost(feet, at) + (guard.role === 'patrol' ? 0 : POST_RELUCTANCE) + (buildingAt(world, feet) === building ? 0 : OTHER_BUILDING)
      return { guard, cost }
    })
    .filter((entry) => entry.cost <= reach)
    .sort((a, b) => a.cost - b.cost)
    .slice(0, count)
    .map((entry) => entry.guard)
}

/** Sends the nearest free pair to look at a spot. The leader investigates; his partner follows and covers. */
export function sendPair(world: World, at: Vec): Guard[] {
  const pair = nearestFree(world, at, 2)
  const [leader, follower] = pair
  if (!leader) return pair
  leader.interest = { at: { ...at }, kind: 'order', priority: 4, reached: false }
  leader.station = null
  setMode(leader, 'investigating')
  barkLine(world, leader, 'orderAck')
  if (follower) followGuard(world, follower, leader)
  return pair
}

export function followGuard(world: World, follower: Guard, leader: Guard): void {
  follower.follow = world.guards.indexOf(leader)
  follower.search = null
  follower.station = null
  setMode(follower, 'searching')
}

/** Starts a guard searching around a feet position (the last known position, a body). */
export function startSearch(world: World, guard: Guard, center: Vec, seconds?: number): void {
  guard.search = planSearch(world, center, seconds, TIERS[guard.tier].search)
  guard.follow = null
  guard.interest = null
  setMode(guard, 'searching')
}

/**
 * The intruder is confirmed: the free guards near the last known position search it in pairs.
 * Everyone else carries on, but the whole site is now on caution.
 */
export function broadcastContact(world: World, center: Vec): void {
  const searchers = nearestFree(world, center, CONTACT_SEARCHERS, CONTACT_REACH)
  for (let index = 0; index < searchers.length; index += 2) {
    const leader = searchers[index]
    leader.lastKnown = { x: center.x, y: center.y - 0.8 }
    leader.lastKnownAt = world.clock
    startSearch(world, leader, center)
    barkLine(world, leader, 'orderAck')
    const follower = searchers[index + 1]
    if (follower) followGuard(world, follower, leader)
  }
  for (const guard of world.guards) {
    if (isFree(guard) && guard.mode === 'calm') setMode(guard, 'caution')
  }
}
