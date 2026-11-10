import { openDoor } from '../interact'
import { nextHop } from '../nav'
import { emitNoise } from '../noise'
import { GRAVITY, moveBody } from '../physics'
import { playSound } from '../sounds'
import { climbStairs } from '../stairs'
import { isSolidAt, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { feetOf, type Guard } from './model'

/**
 * Getting a guard from where he is to a feet position anywhere on the site: along the floor,
 * through doors (opened quietly when calm, kicked in when not), up and down staircases, and,
 * where there are no stairs, ladders. Calm guards never step off a ledge.
 * Each frame a behaviour calls exactly one of `goTo` or `hold`.
 */
export type MoveStatus = 'moving' | 'arrived' | 'blocked'

const ARRIVE = 0.35
const SAME_FLOOR = 1.5
const LADDER_SEARCH_TILES = 45
const CLIMB_SPEED = 5
const JUMP_SPEED = 13
const QUIET_DOOR_NOISE = 2
const KICKED_DOOR_NOISE = 16

/** Stands still (finishing any staircase flight first, since nobody stops halfway up). */
export function hold(world: World, guard: Guard, dt: number): void {
  if (guard.stairs) {
    stepStairs(world, guard, null, dt)
    return
  }
  guard.climbing = false
  walk(world, guard, 0, dt)
}

/** Walks (or runs) toward a feet position. `careful` guards do not drop off ledges or use ladders. */
export function goTo(world: World, guard: Guard, to: Vec, speed: number, dt: number, careful: boolean): MoveStatus {
  if (guard.stairs) {
    stepStairs(world, guard, to.y, dt)
    return 'moving'
  }
  if (guard.climbing) return climbLadder(world, guard, to, dt)
  const feet = feetOf(guard)
  if (!guard.onGround) {
    walk(world, guard, guard.vx * 0.9, dt)
    return 'moving'
  }
  const level = Math.abs(to.y - feet.y) < SAME_FLOOR
  const hop = nextHop(world.stairwells, feet, to)
  if (hop.kind === 'stairs' && !level) {
    guard.stairs = { well: hop.well.id, u: hop.stop }
    return 'moving'
  }
  if (hop.kind === 'none') {
    if (careful) {
      walk(world, guard, 0, dt)
      return 'blocked'
    }
    return startLadder(world, guard, to, speed, dt)
  }
  const goalX = hop.kind === 'walk' ? hop.x : to.x
  const dx = goalX - feet.x
  if (Math.abs(dx) < ARRIVE) {
    walk(world, guard, 0, dt)
    return level ? 'arrived' : 'moving'
  }
  guard.facing = dx > 0 ? 1 : -1
  // A hole in the floor between him and a goal on this floor stops him: dropping in would only send him back up the stairs to try again.
  if ((careful || level) && ledgeAhead(world, guard)) {
    walk(world, guard, 0, dt)
    return 'blocked'
  }
  const pace = Math.min(speed, Math.abs(dx) * 5 + 0.5)
  return walk(world, guard, guard.facing * pace, dt) && !openDoorAhead(world, guard, !careful && speed > 3) ? 'blocked' : 'moving'
}

/** Applies a walking speed with gravity. Returns true when a wall stopped it. */
function walk(world: World, guard: Guard, speed: number, dt: number): boolean {
  guard.vx += (speed - guard.vx) * Math.min(1, dt * 12)
  guard.vy += GRAVITY * dt
  const blocked = moveBody(world.grid, guard, dt)
  return blocked && speed !== 0
}

function ledgeAhead(world: World, guard: Guard): boolean {
  const feet = feetOf(guard)
  const front = feet.x + guard.facing * 0.7
  return !isSolidAt(world.grid, front, feet.y + 0.5) && !isSolidAt(world.grid, front, feet.y + 1.5)
}

/**
 * Opens the door the guard has walked into. A calm guard opens it with a click; a guard in a hurry kicks it in, loudly.
 * Returns true if there was a door.
 */
function openDoorAhead(world: World, guard: Guard, kick: boolean): boolean {
  const feet = feetOf(guard)
  const column = Math.floor(feet.x + guard.facing * 0.8)
  const row = [1, 2, 3].map((up) => Math.floor(feet.y - up)).find((y) => tileAt(world.grid, column, y) === 'door')
  if (row === undefined) {
    if (kick && guard.onGround) guard.vy = -JUMP_SPEED
    return false
  }
  const at = { x: column, y: row }
  openDoor(world.grid, at)
  world.structureChanged = true
  emitNoise(world, at, kick ? KICKED_DOOR_NOISE : QUIET_DOOR_NOISE, 'guard')
  playSound(world, 'door', at)
  return true
}

/** Carries on along a staircase toward the floor with feet row `goalY`; with no goal, stops at the next landing. */
function stepStairs(world: World, guard: Guard, goalY: number | null, dt: number): void {
  const on = guard.stairs!
  const well = world.stairwells.find((candidate) => candidate.id === on.well)
  if (!well) {
    guard.stairs = null
    return
  }
  const goalStop = goalY === null ? -1 : well.stops.findIndex((y) => Math.abs(y - goalY) < 0.5)
  let direction: number
  if (goalY === null) direction = Number.isInteger(on.u) ? 0 : on.u - Math.floor(on.u) < 0.5 ? -1 : 1
  else if (goalStop >= 0) direction = Math.sign(goalStop - on.u)
  else direction = goalY < feetOf(guard).y ? 1 : -1
  if (direction === 0) {
    guard.stairs = null
    return
  }
  const stillGoing = climbStairs(guard, on, well, direction, false, dt)
  if (stillGoing) return
  const atEnd = on.u <= 0 || on.u >= well.stops.length - 1
  const atGoal = goalY === null || on.u === goalStop || (goalStop < 0 && Math.abs(well.stops[on.u] - goalY) < SAME_FLOOR)
  if (atGoal || atEnd) guard.stairs = null
}

/** Where there are no staircases (the small outpost), a guard who is not calm walks to a ladder and climbs it. */
function startLadder(world: World, guard: Guard, to: Vec, speed: number, dt: number): MoveStatus {
  const feet = feetOf(guard)
  const rise = to.y - feet.y
  const column = findLadder(world, feet.x, feet.y, rise < 0)
  if (column === null) {
    walk(world, guard, 0, dt)
    return 'blocked'
  }
  const offset = column + 0.5 - feet.x
  if (Math.abs(offset) < 0.25) {
    guard.climbing = true
    guard.x = column + 0.5 - guard.w / 2
    return 'moving'
  }
  guard.facing = offset > 0 ? 1 : -1
  if (walk(world, guard, guard.facing * speed, dt)) openDoorAhead(world, guard, true)
  return 'moving'
}

function climbLadder(world: World, guard: Guard, to: Vec, dt: number): MoveStatus {
  const feet = feetOf(guard)
  const rise = to.y - feet.y
  const touching = [guard.y + guard.h / 2, feet.y + 0.2].some((y) => tileAt(world.grid, Math.floor(feet.x), Math.floor(y)) === 'ladder')
  if (!touching || Math.abs(rise) < 0.5) {
    // Step off with a small hop toward the goal, clear of the ladder hole.
    guard.climbing = false
    guard.vy = -7
    guard.vx = (to.x > feet.x ? 1 : -1) * 6
    return 'moving'
  }
  guard.vx = 0
  guard.vy = Math.sign(rise) * CLIMB_SPEED
  moveBody(world.grid, guard, dt)
  if (guard.vy === 0) {
    // Blocked by a locked hatch, or back on a floor.
    guard.climbing = false
    return 'blocked'
  }
  return 'moving'
}

/** Nearest column on this floor with a ladder going up (or a ladder hole going down). */
function findLadder(world: World, fromX: number, feetY: number, goingUp: boolean): number | null {
  const bodyRow = Math.floor(feetY - 0.5)
  const start = Math.floor(fromX)
  for (let reach = 0; reach <= LADDER_SEARCH_TILES; reach += 1) {
    for (const column of reach === 0 ? [start] : [start + reach, start - reach]) {
      const found = goingUp
        ? tileAt(world.grid, column, bodyRow) === 'ladder' && tileAt(world.grid, column, bodyRow - 3) === 'ladder'
        : tileAt(world.grid, column, bodyRow + 1) === 'ladder'
      if (found) return column
    }
  }
  return null
}
