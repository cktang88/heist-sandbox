import { landingX } from '../stairs'
import type { Vec } from '../types'
import type { World } from '../world'
import { feetOf, type Guard } from './model'
import { buildingAt, roomById, travelCost } from './places'
import { isFree } from './orders'
import { LEVELS } from './tuning'

/**
 * At alert level 2 and up the control room pulls guards off patrol to hold the choke points around the
 * trouble: stair landings on nearby floors, doubled posts at secure rooms, and at level 3 the elevator lobbies.
 * At level 4 (lockdown) every landing in the building is held.
 */

const STOREY_ROWS = 6
const NEAR_FLOORS = 2

export function assignStations(world: World): void {
  const security = world.security
  security.stationsAt = world.clock
  // Only its own: a station some other errand gave a guard (standing over a partner, a director's event) stays his.
  const held = new Map<string, Guard>()
  for (const [guard, spot] of security.stations) {
    if (guard.station !== spot) continue
    guard.station = null
    held.set(spotKey(spot), guard)
  }
  security.stations.clear()
  const focus = security.focus
  if (security.level < 2 || !focus) return
  const spots = stationSpots(world, focus)
  const limit = security.level >= 4 ? Math.round(LEVELS.maxStations * 1.5) : LEVELS.maxStations
  const wanted = spots.slice(0, limit)
  const taken = new Set<Guard>()
  const station = (guard: Guard, spot: Vec) => {
    taken.add(guard)
    guard.station = spot
    security.stations.set(guard, spot)
  }
  // A spot still wanted keeps the man already on his way to it, before anyone else is picked. Picked afresh by who is
  // nearest now, men walking the long way round to their spots swap them every time the stations are reassigned, and
  // none of them ever gets there.
  const open = wanted.filter((spot) => {
    const holder = held.get(spotKey(spot))
    if (!holder || !isFree(holder) || holder.station) return true
    station(holder, spot)
    return false
  })
  for (const spot of open) {
    const guard = nearestFreeTo(world, spot, taken)
    if (!guard) break
    station(guard, spot)
  }
}

function stationSpots(world: World, focus: Vec): Vec[] {
  const level = world.security.level
  const building = buildingAt(world, focus)
  const floors = level >= 4 ? Infinity : NEAR_FLOORS * STOREY_ROWS + 0.5
  const spots: Vec[] = []
  for (const well of world.stairwells) {
    if (building !== 'site' && well.building !== building) continue
    well.stops.forEach((stopY, stop) => {
      if (Math.abs(stopY - focus.y) <= floors) spots.push({ x: landingX(well, stop) + (stop % 2 === 0 ? 1.2 : -1.2), y: stopY })
    })
  }
  if (level >= 3) {
    for (const shaft of world.elevators) {
      if (building !== 'site' && shaft.building !== building) continue
      const x = shaft.doorSide === 1 ? shaft.x + shaft.w + 1 : shaft.x - 1.5
      for (const stopY of shaft.stops) if (Math.abs(stopY - focus.y) <= STOREY_ROWS + 0.5) spots.push({ x, y: stopY })
    }
  }
  for (const guard of world.guards) {
    const room = roomById(world, guard.roomId)
    if (guard.role !== 'post' || guard.mode === 'dead' || !room || room.security < 2 || room.building !== building) continue
    spots.push({ x: guard.home.x + (guard.home.x > room.x + room.w / 2 ? -1.5 : 1.5), y: guard.home.y })
  }
  return spots.sort((a, b) => travelCost(a, focus) - travelCost(b, focus))
}

function nearestFreeTo(world: World, spot: Vec, taken: Set<Guard>): Guard | null {
  let best: Guard | null = null
  let bestCost = Infinity
  for (const guard of world.guards) {
    if (taken.has(guard) || !isFree(guard) || guard.role !== 'patrol' || guard.station) continue
    const cost = travelCost(feetOf(guard), spot)
    if (cost < bestCost) {
      best = guard
      bestCost = cost
    }
  }
  return best
}

function spotKey(spot: Vec): string {
  return `${spot.x},${spot.y}`
}
