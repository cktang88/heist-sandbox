import type { RoomKind } from '../site'
import type { Vec } from '../types'
import type { World } from '../world'
import type { SearchPlan } from './model'
import { buildingAt, roomOf, sameStretch, storeyAt } from './places'
import { TIMING } from './tuning'

/**
 * Where to look for someone who has slipped away: the last known position first, then the nearest
 * rooms on that floor and the floors just above and below, preferring rooms nobody has checked lately.
 * Rooms are claimed as they are planned, so the next pair sent goes somewhere else.
 */

const ROOMS_PER_PLAN = 3
const FLOOR_PENALTY = 25
/** A room checked within this long counts as searched. */
const SEARCHED_FOR = 60
const OPEN_AIR = new Set<RoomKind>(['street', 'yard', 'rooftop'])
/** With no rooms recorded (the small outpost), sweep either side of the spot instead. */
const SWEEP_OFFSETS = [6, -6, 12]

/** `care` scales how many rooms are checked: veterans are thorough, rookies cut corners. */
export function planSearch(world: World, center: Vec, seconds: number = TIMING.searchSeconds, care = 1): SearchPlan {
  const points: Vec[] = [{ ...center }]
  const building = buildingAt(world, center)
  const storey = storeyAt(world, center)
  const here = roomOf(world, center)
  const candidates = world.rooms
    .filter((room) => room.building === building && room !== here && !OPEN_AIR.has(room.kind) && Math.abs(room.storey - storey) <= 1)
    .map((room) => {
      const claimed = world.clock - (world.security.searched.get(room.id) ?? -Infinity) < SEARCHED_FOR
      const middle = { x: room.x + room.w / 2, y: room.floorY }
      // A room across an elevator core (or a void) on this floor is reached up a flight and back down: two floors' walk.
      const around = room.storey === storey && !sameStretch(world, center, middle) ? 2 * FLOOR_PENALTY : 0
      const cost = Math.abs(middle.x - center.x) + Math.abs(room.storey - storey) * FLOOR_PENALTY + around
      return { room, score: cost * (claimed ? 4 : 1) }
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, Math.max(1, Math.round(ROOMS_PER_PLAN * care)))
  for (const { room } of candidates) {
    world.security.searched.set(room.id, world.clock)
    points.push({ x: room.x + room.w / 2, y: room.floorY })
  }
  if (here) world.security.searched.set(here.id, world.clock)
  if (candidates.length === 0) for (const offset of SWEEP_OFFSETS) points.push({ x: center.x + offset, y: center.y })
  return { points, index: 0, dwell: 0, endsAt: world.clock + seconds }
}
