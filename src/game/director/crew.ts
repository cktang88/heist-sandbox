import { feetOf, isActive, type Guard } from '../security/model'
import type { Room } from '../site'
import { distance, type Vec } from '../types'
import type { World } from '../world'

/**
 * How the director moves people: it gives a calm guard a station (a spot he walks to and holds, the same field the
 * control room uses), and takes it away again to send him back to his route.
 */

/** Calm, unhurt, on nobody's errand: free to be given something to do. */
export function idle(guard: Guard): boolean {
  return isActive(guard) && guard.mode === 'calm' && !guard.radio && guard.station === null && !guard.armored && !guard.restrained
}

export function idleGuards(world: World): Guard[] {
  return world.guards.filter(idle)
}

export function sendTo(guard: Guard, spot: Vec): void {
  guard.station = { x: spot.x, y: spot.y }
}

/** Ends an errand, unless something more pressing (the control room, a fight) has taken him over since. */
export function release(guard: Guard, spot: Vec): void {
  if (guard.station && guard.station.x === spot.x && guard.station.y === spot.y) guard.station = null
}

export function arrived(guard: Guard, spot: Vec): boolean {
  const feet = feetOf(guard)
  return Math.abs(feet.y - spot.y) < 1.5 && Math.abs(feet.x - spot.x) < 1.2
}

/** Still on the errand he was given: alive, awake, and not pulled away by an alarm or a fight. */
export function onErrand(guard: Guard, spot: Vec): boolean {
  return isActive(guard) && guard.station !== null && guard.station.x === spot.x && guard.station.y === spot.y
}

/** A feet position inside a room, `share` of the way across it (0.5 is the middle). */
export function spotIn(room: Room, share = 0.5): Vec {
  return { x: room.x + 1 + (room.w - 2) * share, y: room.floorY }
}

export function roomsOfKind(world: World, kinds: readonly string[], building?: string): Room[] {
  return world.rooms.filter((room) => kinds.includes(room.kind) && (building === undefined || room.building === building))
}

export function nearestTo<T>(items: readonly T[], at: Vec, where: (item: T) => Vec): T | null {
  let best: T | null = null
  let bestGap = Infinity
  for (const item of items) {
    const gap = distance(where(item), at)
    if (gap < bestGap) {
      best = item
      bestGap = gap
    }
  }
  return best
}

export function pick<T>(items: readonly T[], rng: () => number): T | null {
  return items.length === 0 ? null : items[Math.floor(rng() * items.length)]
}

/** Moves a guard somewhere at once, as if he had always been there (only before anyone can see: at setup). */
export function placeAt(guard: Guard, spot: Vec, room: Room | null): void {
  guard.x = spot.x - guard.w / 2
  guard.y = spot.y - guard.h - 0.01
  guard.vx = 0
  guard.vy = 0
  guard.stairs = null
  guard.home = { ...spot }
  guard.homeX = spot.x
  guard.roomId = room?.id ?? null
  guard.route = room && room.w >= 4 ? [{ x: room.x + 1.5, y: room.floorY }, { x: room.x + room.w - 1.5, y: room.floorY }] : []
  guard.routeIndex = 0
}
