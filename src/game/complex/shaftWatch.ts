import type { ElevatorShaft, GuardSpawn, Room } from '../site'
import { isSolidAt, tileAt, type Grid } from '../tiles'
import { VISION } from '../security/tuning'

/**
 * Nobody stands guard over an elevator's doors or a shaft's maintenance doors. Someone slipping through them (prying
 * the elevator open, or stepping onto the service ladder) must always get a moment unseen: a guard posted in view of
 * one would watch it for the whole heist. So posts in view become patrols that walk their room, and no patrol stops and
 * turns right beside one. Walking guards pass the doors and walk away again, leaving gaps to go through.
 */

/** A guard further than this from a door never makes out someone at it, even facing it in full light. */
export const WATCH_RANGE = VISION.centralRange + 2
/** A patrol's round never ends closer to a door than this: he would stand and look at it as he turns. */
export const TURN_CLEARANCE = 4
/** A patrol walks at least this far, or he is as good as a post. */
const MIN_BEAT = 2

/** Where someone stands to go through a shaft's doors: outside the elevator doors, and outside a maintenance door. */
export type ShaftDoorSpot = { x: number; y: number; what: string }

export function shaftDoorSpots(grid: Grid, elevators: readonly ElevatorShaft[]): ShaftDoorSpot[] {
  const spots: ShaftDoorSpot[] = []
  for (const shaft of elevators) {
    const front = shaft.doorSide === 1 ? shaft.x + shaft.w : shaft.x - 1
    const back = shaft.doorSide === 1 ? shaft.x - 1 : shaft.x + shaft.w
    for (const stop of shaft.stops) {
      spots.push({ x: front + 0.5 + shaft.doorSide * 1.5, y: stop, what: `elevator ${shaft.id} doors at ${stop}` })
      if (tileAt(grid, back, stop - 1) === 'door') spots.push({ x: back + 0.5 - shaft.doorSide * 1.5, y: stop, what: `elevator ${shaft.id} maintenance door at ${stop}` })
    }
  }
  return spots
}

/** A guard standing at `x` on floor `y` has an open view along the floor to `spot` (walls and shut doors block it). */
export function viewAlongFloor(grid: Grid, x: number, spot: ShaftDoorSpot): boolean {
  const eyeRow = spot.y - 2
  const [from, to] = [Math.min(x, spot.x), Math.max(x, spot.x)]
  for (let column = Math.floor(from) + 1; column < Math.floor(to); column += 1) if (isSolidAt(grid, column, eyeRow)) return false
  return true
}

function watches(grid: Grid, x: number, y: number, spot: ShaftDoorSpot): boolean {
  return spot.y === y && Math.abs(x + 0.5 - spot.x) <= WATCH_RANGE && viewAlongFloor(grid, x + 0.5, spot)
}

/** Guards who stay put at their post all heist (a patrol walks; everyone else stands). */
const standsStill = (guard: GuardSpawn) => !guard.route || guard.route.length < 2

/** Turns posts in view of a shaft's doors into patrols, and moves the ends of patrols' rounds away from the doors. */
export function clearShaftSightlines(grid: Grid, rooms: readonly Room[], elevators: readonly ElevatorShaft[], guards: GuardSpawn[]): void {
  const spots = shaftDoorSpots(grid, elevators)
  for (const guard of guards) {
    const room = guard.roomId === undefined ? undefined : rooms[guard.roomId]
    const near = spots.filter((spot) => watches(grid, guard.x, guard.y, spot))
    if (!standsStill(guard)) {
      moveTurnsAway(guard, spots, room)
      continue
    }
    if (near.length === 0) continue
    if (guard.role === 'operator') {
      // At the monitors he keeps his seat, but looks the other way.
      guard.facing = near[0].x > guard.x + 0.5 ? -1 : 1
      continue
    }
    const beat = room && room.floorY === guard.y ? beatClearOf(room, spots.filter((spot) => spot.y === room.floorY)) : null
    if (!beat) continue
    guard.role = 'patrol'
    guard.route = [{ x: beat.from, y: guard.y }, { x: beat.to, y: guard.y }]
    if (guard.x < beat.from || guard.x > beat.to) guard.x = beat.from
  }
}

/** Pulls the ends of a patrol's round back from any shaft door they turn beside; failing that, he walks his room clear of them. */
function moveTurnsAway(guard: GuardSpawn, spots: readonly ShaftDoorSpot[], room: Room | undefined): void {
  const route = guard.route!
  if (!route.some((point) => spots.some((spot) => turnsBeside(point, spot)))) return
  const [a, b] = [route[0], route[route.length - 1]]
  const moved = route.map((point) => {
    const spot = spots.find((candidate) => turnsBeside(point, candidate))
    if (!spot) return point
    const other = point === a ? b : a
    const away = other.x >= point.x ? 1 : -1
    return { x: Math.round(spot.x - 0.5 + away * TURN_CLEARANCE), y: point.y }
  })
  const ends = [moved[0], moved[moved.length - 1]]
  const ok = route.length === 2 && Math.abs(ends[1].x - ends[0].x) >= MIN_BEAT && (ends[1].x - ends[0].x) * (b.x - a.x) > 0
    && !moved.some((point) => spots.some((spot) => turnsBeside(point, spot)))
  if (ok) {
    guard.route = moved
    return
  }
  const beat = room && room.floorY === guard.y ? beatClearOf(room, spots.filter((spot) => spot.y === room.floorY)) : null
  if (!beat) return
  guard.route = [{ x: beat.from, y: guard.y }, { x: beat.to, y: guard.y }]
  if (guard.x < beat.from || guard.x > beat.to) guard.x = beat.from
}

function turnsBeside(point: { x: number; y: number }, spot: ShaftDoorSpot): boolean {
  return point.y === spot.y && Math.abs(point.x + 0.5 - spot.x) < TURN_CLEARANCE
}

/** The longest stretch of the room's floor a patrol can walk end to end without turning beside a shaft door. */
function beatClearOf(room: Room, spots: readonly ShaftDoorSpot[]): { from: number; to: number } | null {
  let from = room.x + 1
  let to = room.x + room.w - 2
  for (const spot of spots) {
    const column = spot.x - 0.5
    if (column < room.x - TURN_CLEARANCE || column > room.x + room.w - 1 + TURN_CLEARANCE) continue
    if (column - room.x < room.x + room.w - 1 - column) from = Math.max(from, Math.ceil(column + TURN_CLEARANCE))
    else to = Math.min(to, Math.floor(column - TURN_CLEARANCE))
  }
  return to - from >= MIN_BEAT ? { from, to } : null
}

/** For the site audit: every guard who would stand watching a shaft's doors, or turn his round beside them. */
export function shaftWatchProblems(grid: Grid, elevators: readonly ElevatorShaft[], guards: readonly GuardSpawn[]): string[] {
  const problems: string[] = []
  const spots = shaftDoorSpots(grid, elevators)
  for (const guard of guards) {
    const where = `${guard.role ?? 'guard'} at ${guard.x},${guard.y}`
    for (const spot of spots) {
      if (standsStill(guard) && guard.role !== 'operator' && watches(grid, guard.x, guard.y, spot)) problems.push(`${where} watches ${spot.what}`)
      if (guard.role === 'operator' && watches(grid, guard.x, guard.y, spot) && (spot.x - guard.x - 0.5) * guard.facing > 0) problems.push(`${where} faces ${spot.what}`)
      for (const point of guard.route ?? []) if (turnsBeside(point, spot)) problems.push(`${where} turns beside ${spot.what}`)
    }
  }
  return problems
}
