import type { Room, Stairwell } from '../site'
import { landingX } from '../stairs'
import { isSolidAt, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { isActive } from './model'
import { sameStretch } from './places'

/**
 * Spots on the complex for the scripted fights (fightScript.ts), found from the site itself rather than written down
 * as numbers, so they stay meaningful when the generator moves rooms about. All are feet positions. Only tests import this.
 */

/** The tower's west staircase: the one with the leftmost landings. */
function westStairs(world: World): Stairwell {
  const wells = world.stairwells.filter((well) => well.building === 'tower')
  if (wells.length === 0) throw new Error('no tower staircase')
  return wells.reduce((west, well) => (Math.min(well.leftX, well.rightX) < Math.min(west.leftX, west.rightX) ? well : west))
}

/** A storey half way up the west staircase. */
function middleStop(well: Stairwell): number {
  return Math.floor(well.stops.length / 2)
}

function roomAround(world: World, at: Vec, kind: Room['kind']): Room {
  const room = world.rooms.find((candidate) => candidate.kind === kind && Math.abs(candidate.floorY - at.y) < 0.5 && at.x >= candidate.x && at.x <= candidate.x + candidate.w)
  if (!room) throw new Error(`no ${kind} at ${at.x},${at.y}`)
  return room
}

/**
 * Doorway columns in the side walls of a room (a door tile, or an opening under a lintel, in the row above the floor).
 * An elevator's doors are no way through: a stair lobby beside an elevator core has the shaft's doors in that wall.
 */
function doorColumns(world: World, room: Room): number[] {
  const intoShaft = (x: number) => {
    const beyond = x < room.x ? x - 1 : x + 1
    return world.elevators.some((shaft) => beyond >= shaft.x && beyond < shaft.x + shaft.w)
  }
  return [room.x - 1, room.x + room.w].filter((x) => {
    if (intoShaft(x)) return false
    const kind = tileAt(world.grid, x, room.floorY - 1)
    return kind === 'door' || (!isSolidAt(world.grid, x, room.floorY - 1) && isSolidAt(world.grid, x, room.floorY - 4))
  })
}

/** Guards are about on the stretch of floor this side of any elevator core or void, within a rifle shot of the spot. */
function manned(world: World, at: Vec): boolean {
  return world.guards.some((guard) => {
    const feet = { x: guard.x + guard.w / 2, y: guard.y + guard.h }
    return isActive(guard) && Math.abs(feet.x - at.x) < MANNED_REACH && sameStretch(world, feet, at)
  })
}

/**
 * The stop nearest the middle of the west stairs whose stairwell has a door onto floor where guards are about, or the
 * middle stop if none has. An elevator core splits most storeys of the tower now, and the stretch of floor beyond a
 * stairwell's one door can be empty: then there is no fight to watch there.
 */
function fightingStop(world: World, well: Stairwell): number {
  const middle = middleStop(well)
  const byMiddle = well.stops.map((_, stop) => stop).sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))
  return byMiddle.find((stop) => {
    const y = well.stops[stop]
    const room = world.rooms.find((candidate) => candidate.kind === 'stairwell' && Math.abs(candidate.floorY - y) < 0.5
      && landingX(well, stop) >= candidate.x && landingX(well, stop) <= candidate.x + candidate.w)
    return room !== undefined && doorColumns(world, room).some((door) => manned(world, { x: door < room.x ? door - 1 : door + 1.5, y }))
  }) ?? middle
}

/**
 * On a storey's landing of the tower's west stairs, near the middle of them (see fightingStop), at the end nearest a
 * door of the stairwell.
 */
export function stairLandingSpot(world: World): Vec {
  const well = westStairs(world)
  const stop = fightingStop(world, well)
  const y = well.stops[stop]
  const room = roomAround(world, { x: landingX(well, stop), y }, 'stairwell')
  const doors = doorColumns(world, room)
  const landings = [well.leftX, well.rightX]
  const x = doors.length === 0 ? landingX(well, stop) : landings.reduce((best, candidate) => (gapToDoor(candidate, doors) < gapToDoor(best, doors) ? candidate : best))
  return { x, y }
}

/** Inside the same stairwell, a few steps in from its door at the other end from the landing spot. */
export function stairDoorSpot(world: World): Vec {
  const landing = stairLandingSpot(world)
  const room = roomAround(world, landing, 'stairwell')
  const doors = doorColumns(world, room)
  if (doors.length === 0) throw new Error('stairwell without doors')
  const door = doors.reduce((far, candidate) => (Math.abs(candidate - landing.x) > Math.abs(far - landing.x) ? candidate : far))
  const inward = door < room.x ? 1 : -1
  return { x: door + 0.5 + inward * 3, y: landing.y }
}

/** On the tower roof right beside the highest executive room, and the three roof tiles over it to blow in as a skylight. */
export function roofSpot(world: World): { spot: Vec; skylight: { x0: number; x1: number; y: number } } {
  const rooms = world.rooms.filter((room) => room.kind === 'executive' && room.building === 'tower' && openAbove(world, room))
  if (rooms.length === 0) throw new Error('no executive room under the roof')
  const room = rooms.reduce((top, candidate) => (candidate.floorY < top.floorY ? candidate : top))
  const roofY = room.floorY - 6
  const x0 = Math.floor(room.x + room.w / 2) - 1
  return { spot: { x: x0 + 3 + 1.1, y: roofY }, skylight: { x0, x1: x0 + 2, y: roofY } }
}

/** Is the room's ceiling the roof: open sky for a storey above its middle? */
function openAbove(world: World, room: Room): boolean {
  const x = Math.floor(room.x + room.w / 2)
  return isSolidAt(world.grid, x, room.floorY - 6) && [1, 2, 3, 4].every((up) => !isSolidAt(world.grid, x, room.floorY - 6 - up))
}

/**
 * Hanging outside the tower's west wall, level with a window, on the storey nearest the middle of the west stairs that
 * has guards about inside the window (any storey with a window, if none has). Any storey of the tower will do, not
 * only the west stairs' own: the west stairs may be a short flight beside the west elevator, whose shaft blinds the
 * west wall on every storey they serve.
 */
export function outsideWindowSpot(world: World): Vec {
  const well = westStairs(world)
  const wall = well.bounds?.x0
  if (wall === undefined) throw new Error('tower has no bounds')
  const middle = well.stops[middleStop(well)]
  const storeys = new Set(world.stairwells.filter((other) => other.building === well.building).flatMap((other) => other.stops))
  const floors = [...storeys].sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))
    .filter((floor) => [1, 2, 3].some((up) => tileAt(world.grid, wall, floor - up) === 'glass'))
  const y = floors.find((floor) => manned(world, { x: wall + 1.5, y: floor })) ?? floors[0]
  if (y === undefined) throw new Error('no west window')
  return { x: wall - 1.4, y }
}

/** How far from a spot guards count as about: the player's rifle reach in the scripted fights. */
const MANNED_REACH = 25

function gapToDoor(x: number, doors: number[]): number {
  return Math.min(...doors.map((door) => Math.abs(door + 0.5 - x)))
}

/**
 * In the sewer at the foot of the yard manhole's ladder (the hatch nearest the tower), with a guard put on the ground
 * above it, already fighting, if nobody is posted near. The guards have to come down through the hatch.
 */
export function sewerHatchSpot(world: World): Vec {
  const tower = westStairs(world).bounds
  const hatches: number[] = []
  for (let x = 0; x < world.grid.width; x += 1) {
    if (tileAt(world.grid, x, world.groundY) === 'door' && tileAt(world.grid, x, world.groundY + 1) === 'ladder') hatches.push(x)
  }
  if (hatches.length === 0) throw new Error('no manhole')
  const middle = tower ? (tower.x0 + tower.x1) / 2 : world.grid.width / 2
  const hatch = hatches.reduce((best, x) => (Math.abs(x - middle) < Math.abs(best - middle) ? x : best))
  // Down the ground to the sewer's air, then on to its floor.
  let floor = world.groundY + 1
  while (floor < world.grid.height - 1 && isSolidAt(world.grid, hatch + 2, floor)) floor += 1
  while (floor < world.grid.height - 1 && !isSolidAt(world.grid, hatch + 2, floor)) floor += 1
  return { x: hatch + 2.5, y: floor }
}

/** On a middle storey of the tower, beside a hole blown in an office floor, firing down into the room below. */
export function floorHoleSpot(world: World): { spot: Vec; hole: { x0: number; x1: number; y: number } } {
  const well = westStairs(world)
  const middle = well.stops[middleStop(well)]
  const offices = world.rooms.filter((room) => room.building === 'tower' && room.kind === 'office' && room.w >= 10 && room.floorY < world.groundY)
  if (offices.length === 0) throw new Error('no tower office')
  const room = offices.reduce((best, candidate) => (Math.abs(candidate.floorY - middle) < Math.abs(best.floorY - middle) ? candidate : best))
  const x0 = Math.floor(room.x + room.w / 2)
  return { spot: { x: x0 - 1.1, y: room.floorY }, hole: { x0, x1: x0 + 1, y: room.floorY } }
}
