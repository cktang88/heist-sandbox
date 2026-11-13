import { roomAt, type Room } from '../site'
import { floorJoins } from '../nav'
import { landingX } from '../stairs'
import { isSolidAt } from '../tiles'
import type { Vec } from '../types'
import type { Device, World } from '../world'

/** Where things are, in the terms guards and the control room talk in: buildings, floors, rooms, landings. */

const STOREY_ROWS = 6

export function roomOf(world: World, feet: Vec): Room | undefined {
  return roomAt(world.rooms, feet.x, feet.y - 0.5)
}

export function roomById(world: World, id: number | null | undefined): Room | undefined {
  if (id === null || id === undefined) return undefined
  return world.rooms[id]?.id === id ? world.rooms[id] : world.rooms.find((room) => room.id === id)
}

/** Building name at a spot, or 'site' for anywhere outside a recorded room (the small outpost has none). */
export function buildingAt(world: World, at: Vec): string {
  return roomOf(world, at)?.building ?? 'site'
}

export function deviceBuilding(world: World, device: Device): string {
  return roomById(world, device.roomId)?.building ?? buildingAt(world, { x: device.x + 0.5, y: device.y + 2 })
}

export function storeyAt(world: World, feet: Vec): number {
  return roomOf(world, feet)?.storey ?? Math.round((world.groundY - feet.y) / STOREY_ROWS)
}

/** "floor 12", "the ground floor", "basement 2": how a guard names where something is. */
export function floorName(world: World, at: Vec): string {
  const storey = storeyAt(world, { x: at.x, y: at.y + 1 })
  if (storey === 0) return 'the ground floor'
  return storey < 0 ? `basement ${-storey}` : `floor ${storey}`
}

/** Rough walking cost between two feet positions: changing floors costs far more than walking along one. */
export function travelCost(from: Vec, to: Vec): number {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y) * 3
}

export function sameFloor(a: Vec, b: Vec): boolean {
  return Math.abs(a.y - b.y) < 1.5
}

/**
 * Can he walk straight from `a` to `b` along one floor: the same floor, with no void or elevator core cutting it
 * between them? A spot across a split is on the same floor in name only: the way there is round by the stairs.
 * The car of an elevator, at a stop or not, is no part of the floor either.
 */
export function sameStretch(world: World, a: Vec, b: Vec): boolean {
  if (!sameFloor(a, b) || !floorJoins(world.stairwells, a.y, a.x, b.x)) return false
  const low = Math.min(a.x, b.x)
  const high = Math.max(a.x, b.x)
  return !world.elevators.some((shaft) => {
    if (low >= shaft.x + shaft.w || high <= shaft.x || shaft.stops.length === 0) return false
    const ends = [shaft.stops[0], shaft.stops[shaft.stops.length - 1]]
    return a.y > Math.min(...ends) - 1.5 && a.y < Math.max(...ends) + 1.5
  })
}

/** Feet position of every stair landing on the floor with this feet row. */
export function landingsOnFloor(world: World, floorY: number): Vec[] {
  const landings: Vec[] = []
  for (const well of world.stairwells) {
    well.stops.forEach((stopY, stop) => {
      if (Math.abs(stopY - floorY) < 0.5) landings.push({ x: landingX(well, stop), y: stopY })
    })
  }
  return landings
}

/** Where someone stands to use a device: on the floor below it. */
export function deviceFeet(world: World, device: Device): Vec {
  const x = device.x + 0.5
  const room = roomById(world, device.roomId)
  if (room) return { x, y: room.floorY }
  for (let y = Math.floor(device.y); y < device.y + STOREY_ROWS; y += 1) if (isSolidAt(world.grid, x, y)) return { x, y }
  return { x, y: device.y + 2 }
}

/**
 * The feet position under a point: the first solid row at or below it (a body's hip, a sound, a sighting).
 * Looks all the way down, since a blast often takes the floor out from under the spot it marks and a sound can come
 * from a shaft: a point that is not on any floor would leave guards walking back and forth over the hole, or riding
 * the stairs for good toward a storey that does not exist.
 */
export function floorBelow(world: World, at: Vec): Vec {
  for (let y = Math.max(0, Math.floor(at.y)); y < world.grid.height; y += 1) if (isSolidAt(world.grid, at.x, y)) return roomFloor(world, { x: at.x, y })
  return { x: at.x, y: Math.ceil(at.y) }
}

/**
 * Rubble heaped on a room's floor is still that room's floor. Routes are planned by storeys, and a goal partway up a
 * room reads as a floor of its own that no staircase reaches: guards would ride the stairs up and down for good.
 */
function roomFloor(world: World, feet: Vec): Vec {
  const room = roomOf(world, feet)
  return room && feet.y < room.floorY && feet.y > room.floorY - STOREY_ROWS + 1 ? { x: feet.x, y: room.floorY } : feet
}

/**
 * Is this column a doorway on the floor with feet row `floorY`: a lintel overhead and open below it, in a wall no more
 * than three tiles thick (a partition's door, or a hole blown through a facade with wall left above it)?
 * Standing in one in a fight makes a guard a silhouette in a frame.
 */
export function isDoorway(world: World, column: number, floorY: number): boolean {
  const x = Math.floor(column) + 0.5
  const lintel = isSolidAt(world.grid, x, floorY - 3.5)
  const open = !isSolidAt(world.grid, x, floorY - 1.5) && !isSolidAt(world.grid, x, floorY - 2.5)
  if (!lintel || !open) return false
  const clearWithin = (side: number) => [1, 2, 3].some((step) => !isSolidAt(world.grid, x + side * step, floorY - 3.5))
  return clearWithin(-1) && clearWithin(1)
}

export function unitName(index: number): string {
  return `Unit ${index + 1}`
}
