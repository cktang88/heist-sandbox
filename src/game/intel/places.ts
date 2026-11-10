import { STOREY } from '../complex/kit'
import { boxHitsSolid } from '../physics'
import type { Room, RoomKind } from '../site'
import { isSolidAt } from '../tiles'
import type { Rng } from '../rng'
import type { World } from '../world'
import type { Place, PlaceKind, Side } from './types'

/** The rooms each kind of place can be. A "safe" is the one in an executive office or the penthouse. */
export const PLACE_ROOMS: Record<PlaceKind, readonly RoomKind[]> = {
  vault: ['vault'],
  safe: ['executive', 'penthouse'],
  lab: ['lab'],
  storage: ['storage'],
  armory: ['armory'],
}

const PLACE_KINDS = Object.keys(PLACE_ROOMS) as PlaceKind[]
const OPEN_AIR = new Set(['grounds', 'sewer', 'silo'])
const MIN_HEADROOM = 4
const CASE_SIZE = 0.8

/**
 * The plausible places the case could be kept: the vault, plus one room of each other kind (a safe, a lab,
 * a storage cage, an armoury) picked at random. A site with no rooms of these kinds (the small outpost)
 * has only its vault, where the case already sits.
 */
export function candidatePlaces(world: World, rng: Rng): Place[] {
  const places: Place[] = []
  for (const kind of PLACE_KINDS) {
    const rooms = world.rooms.filter((room) => fits(world, room, kind))
    const preferred = kind === 'safe' ? rooms.filter((room) => hasSafe(world, room)) : []
    const pool = preferred.length > 0 ? preferred : rooms
    if (pool.length === 0) continue
    const room = pool.length === 1 ? pool[0] : pool[Math.floor(rng() * pool.length)]
    places.push(placeOf(world, room, kind, places.length))
  }
  if (places.length === 0) places.push(outpostVault(world))
  return places
}

function fits(world: World, room: Room, kind: PlaceKind): boolean {
  return PLACE_ROOMS[kind].includes(room.kind) && !OPEN_AIR.has(room.building) && room.h >= MIN_HEADROOM && spotIn(world, room) !== null
}

function hasSafe(world: World, room: Room): boolean {
  return world.props.some((prop) => prop.roomId === room.id && (prop.kind === 'safeSmall' || prop.kind === 'safeLarge'))
}

function placeOf(world: World, room: Room, kind: PlaceKind, id: number): Place {
  return { id, kind, roomId: room.id, building: room.building, storey: room.storey, side: sideOf(world, room.building, room.x + room.w / 2), x: room.x, w: room.w, floorY: room.floorY }
}

/** The small site's vault has no room record: its place is drawn around where the case sits. */
function outpostVault(world: World): Place {
  const x = Math.floor(world.loot.x)
  return { id: 0, kind: 'vault', roomId: null, building: 'building', storey: -1, side: 'west', x: x - 3, w: 7, floorY: Math.round(world.loot.y + world.loot.h) }
}

/** Columns from a building's leftmost room to the right edge of its rightmost one. */
export function buildingSpan(world: World, building: string): { left: number; right: number } | null {
  const rooms = world.rooms.filter((room) => room.building === building)
  if (rooms.length === 0) return null
  return { left: Math.min(...rooms.map((room) => room.x)), right: Math.max(...rooms.map((room) => room.x + room.w)) }
}

/** West is the left half of the building as seen on screen. */
function sideOf(world: World, building: string, x: number): Side {
  const span = buildingSpan(world, building)
  return !span || x < (span.left + span.right) / 2 ? 'west' : 'east'
}

/** The floor row of a storey in a building, worked out from any of its rooms (storeys are evenly stacked). */
export function floorYOf(world: World, building: string, storey: number): number | null {
  const room = world.rooms.find((candidate) => candidate.building === building)
  return room ? room.floorY + (room.storey - storey) * STOREY : null
}

/**
 * Where the case can rest in a room: a column near the middle with a solid floor under the whole case
 * and open air above it. Null if the room has no such spot.
 */
export function spotIn(world: World, room: Pick<Room, 'x' | 'w' | 'floorY'>): number | null {
  const middle = Math.floor(room.x + room.w / 2)
  for (let offset = 0; offset < room.w; offset += 1) {
    for (const x of [middle + offset, middle - offset]) {
      if (x < room.x || x + 1 > room.x + room.w) continue
      const box = { x: x + 0.1, y: room.floorY - CASE_SIZE - 0.01, w: CASE_SIZE, h: CASE_SIZE }
      if (!boxHitsSolid(world.grid, box) && isSolidAt(world.grid, x, room.floorY)) return box.x
    }
  }
  return null
}

/** Puts the case at rest in a place. */
export function putLootIn(world: World, place: Place): void {
  const x = spotIn(world, place) ?? place.x + place.w / 2
  Object.assign(world.loot, { x, y: place.floorY - CASE_SIZE, vx: 0, vy: 0, onGround: true })
}
