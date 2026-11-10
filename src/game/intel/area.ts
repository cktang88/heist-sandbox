import { ROOM_HEIGHT } from '../complex/kit'
import type { Room } from '../site'
import type { Rect } from '../types'
import type { World } from '../world'
import { describeFilter, matches } from './describe'
import { buildingSpan, floorYOf, PLACE_ROOMS } from './places'
import type { Clue, ClueFilter, IntelState } from './types'

/**
 * The search area: what all the current clues add up to. The candidate place most clues point at is taken
 * as the best guess (written and confirmed clues count for more), and the clues that agree with it are
 * combined into one claim. The HUD draws it as a highlighted region of the building, with the rooms of the
 * named kind outlined inside it. It never shows the candidate places themselves, only what was said.
 */
export type SearchArea = { filter: ClueFilter; label: string; region: Rect | null; rooms: Room[] }

const WRITTEN_WEIGHT = 1.3
const CONFIRMED_BONUS = 1

export function searchFilter(intel: IntelState): ClueFilter | null {
  const active = intel.clues.filter((clue) => !clue.stale)
  if (active.length === 0) return null
  let best = intel.places[0]
  let bestScore = 0
  for (const place of intel.places) {
    const score = active.filter((clue) => matches(clue.filter, place)).reduce((sum, clue) => sum + weightOf(clue), 0)
    if (score > bestScore) [best, bestScore] = [place, score]
  }
  if (bestScore === 0) return null
  return active.filter((clue) => matches(clue.filter, best)).map((clue) => clue.filter).reduce(combine)
}

function weightOf(clue: Clue): number {
  const base = clue.source === 'document' || clue.source === 'terminal' ? WRITTEN_WEIGHT : 1
  return base + (clue.confirmed ? CONFIRMED_BONUS : 0)
}

/** Both claims at once. They come from clues that fit the same place, so they never contradict. */
function combine(a: ClueFilter, b: ClueFilter): ClueFilter {
  const storeys = a.storeys && b.storeys ? { min: Math.max(a.storeys.min, b.storeys.min), max: Math.min(a.storeys.max, b.storeys.max) } : a.storeys ?? b.storeys
  return { building: a.building, storeys, side: a.side ?? b.side, kind: a.kind ?? b.kind, place: a.place ?? b.place }
}

const cache = new WeakMap<IntelState, { version: number; area: SearchArea | null }>()

/** The current search area, worked out again only when the clues change. */
export function searchArea(world: World): SearchArea | null {
  const known = cache.get(world.intel)
  if (known && known.version === world.intel.version) return known.area
  const area = buildArea(world)
  cache.set(world.intel, { version: world.intel.version, area })
  return area
}

function buildArea(world: World): SearchArea | null {
  const filter = searchFilter(world.intel)
  if (!filter) return null
  const place = filter.place === undefined ? undefined : world.intel.places[filter.place]
  const region = place ? { x: place.x, y: place.floorY - ROOM_HEIGHT, w: place.w, h: ROOM_HEIGHT } : regionOf(world, filter)
  const kinds = filter.kind ? PLACE_ROOMS[filter.kind] : null
  const rooms = kinds && region && !place ? world.rooms.filter((room) => kinds.includes(room.kind) && inside(room, region)) : []
  return { filter, label: describeFilter(filter), region, rooms }
}

/** The part of the building the claim covers: its storey band (or all of it), cut to one half for a side. */
function regionOf(world: World, filter: ClueFilter): Rect | null {
  const span = buildingSpan(world, filter.building)
  const rooms = world.rooms.filter((room) => room.building === filter.building)
  if (!span || rooms.length === 0) return null
  const low = filter.storeys?.min ?? Math.min(...rooms.map((room) => room.storey))
  const high = filter.storeys?.max ?? Math.max(...rooms.map((room) => room.storey))
  const bottom = floorYOf(world, filter.building, Math.max(low, Math.min(...rooms.map((room) => room.storey))))!
  const top = floorYOf(world, filter.building, Math.min(high, Math.max(...rooms.map((room) => room.storey))))! - ROOM_HEIGHT
  const middle = (span.left + span.right) / 2
  const left = filter.side === 'east' ? middle : span.left
  const right = filter.side === 'west' ? middle : span.right
  return { x: left, y: top, w: right - left, h: bottom - top }
}

function inside(room: Room, region: Rect): boolean {
  const x = room.x + room.w / 2
  return x >= region.x && x <= region.x + region.w && room.floorY > region.y && room.floorY <= region.y + region.h
}
