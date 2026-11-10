import { landingX } from '../stairs'
import { isSolidAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { barkLine } from './barks'
import { feetOf, type Guard } from './model'
import { goTo, hold } from './movement'
import { roomById, sameFloor } from './places'
import { PATROL } from './tuning'

/**
 * Calm and caution behaviour: walk the route with varied pauses, or stand the post and look around.
 * A guard who has wandered off (to investigate, to search) walks back first. An ordered station overrides both.
 */

const STAIR_CHECK_REACH = 30

export function patrolBehaviour(world: World, guard: Guard, dt: number): void {
  const caution = guard.mode === 'caution' || world.security.level >= 1
  const speed = caution ? PATROL.walkSpeed * 1.3 : PATROL.walkSpeed
  if (guard.station) {
    standAt(world, guard, guard.station, speed, dt, true)
    return
  }
  if (guard.role !== 'patrol') {
    standAt(world, guard, guard.home, speed, dt, guard.role !== 'operator')
    return
  }
  if (guard.route.length < 2) guard.route = defaultRoute(world, guard)
  if (guard.wait > 0) {
    lookAround(guard, dt)
    hold(world, guard, dt)
    return
  }
  const goal = guard.detour ?? guard.route[guard.routeIndex]
  const status = goTo(world, guard, goal, speed, dt, true)
  if (status === 'moving') return
  if (guard.detour) guard.detour = null
  else guard.routeIndex = (guard.routeIndex + 1) % guard.route.length
  pickPause(world, guard, caution)
}

/** Holds a spot: walk there, then turn now and then to watch both ways. */
function standAt(world: World, guard: Guard, spot: Vec, speed: number, dt: number, turns: boolean): void {
  const feet = feetOf(guard)
  if (!sameFloor(feet, spot) || Math.abs(feet.x - spot.x) > 0.6) {
    if (goTo(world, guard, spot, speed, dt, true) === 'arrived' && guard.station) barkLine(world, guard, 'station')
    return
  }
  hold(world, guard, dt)
  if (!turns) return
  guard.wait -= dt
  if (guard.wait > 0) return
  guard.facing = guard.facing === 1 ? -1 : 1
  guard.wait = PATROL.postTurnMin + world.rng() * (PATROL.postTurnMax - PATROL.postTurnMin)
}

function lookAround(guard: Guard, dt: number): void {
  const before = guard.wait
  guard.wait -= dt
  // Glance back once in the middle of a pause.
  if (before > 1.2 && guard.wait <= 1.2) guard.facing = guard.facing === 1 ? -1 : 1
}

/** Predictable in structure, varied in timing: a dwell of random length, and now and then a detour. */
function pickPause(world: World, guard: Guard, caution: boolean): void {
  const roll = world.rng()
  const dwell = PATROL.dwellMin + world.rng() * (PATROL.dwellMax - PATROL.dwellMin)
  guard.wait = caution ? dwell * 0.5 : dwell
  if (roll < PATROL.stairCheckOdds) {
    guard.detour = stairCheck(world, guard)
    guard.wait = 0.5
  } else if (roll < PATROL.stairCheckOdds + PATROL.pauseOdds) {
    guard.wait = 0.3
    const feet = feetOf(guard)
    const next = guard.route[guard.routeIndex]
    guard.detour = { x: (feet.x + next.x) / 2, y: feet.y }
  }
}

/** A look into the stairwell: the landing on the floor above or below, if a staircase is near. */
function stairCheck(world: World, guard: Guard): Vec | null {
  const feet = feetOf(guard)
  for (const well of world.stairwells) {
    const stop = well.stops.findIndex((y) => Math.abs(y - feet.y) < 0.5)
    if (stop < 0 || Math.abs(landingX(well, stop) - feet.x) > STAIR_CHECK_REACH) continue
    const other = stop + 1 < well.stops.length ? stop + 1 : stop - 1
    if (other >= 0) return { x: landingX(well, other), y: well.stops[other] }
  }
  return null
}

/** A guard with no route walks his room, or as far either side of home as the floor lets him. */
export function defaultRoute(world: World, guard: Guard): Vec[] {
  const room = roomById(world, guard.roomId)
  if (room && room.w >= 4) return [{ x: room.x + 1.5, y: room.floorY }, { x: room.x + room.w - 1.5, y: room.floorY }]
  const home = guard.home
  return [{ x: walkableEdge(world, home, -1, guard.patrolRange), y: home.y }, { x: walkableEdge(world, home, 1, guard.patrolRange), y: home.y }]
}

/** How far along the floor a calm guard can walk from home before a wall, a door or a drop. */
function walkableEdge(world: World, home: Vec, side: 1 | -1, range: number): number {
  let x = home.x
  for (let step = 0; step < range; step += 1) {
    const next = x + side
    const wall = [0.5, 1.5].some((up) => isSolidAt(world.grid, next, home.y - up))
    const drop = !isSolidAt(world.grid, next, home.y + 0.5)
    if (wall || drop) break
    x = next
  }
  return x
}
