import type { Room } from '../site'
import { isSolidAt, tileAt, type Grid } from '../tiles'
import type { SiteDraft } from '../complex/kit'

/** A stretch of floor, in continuous tile x: furniture may stand anywhere from `from` to `to`. */
export type Span = { from: number; to: number }

/** Floor kept clear around doorways, ladders and stair landings so nobody trips on the way through. */
export const CLEARANCE = 1.5

/** A column people can furnish: solid floor, open air above, and no ladder or hatch running through it. */
function usableColumn(grid: Grid, room: Room, x: number): boolean {
  return isSolidAt(grid, x, room.floorY) && !isSolidAt(grid, x, room.floorY - 1) && !climbsThrough(grid, room, x)
}

/** A ladder or a floor hatch in this column: people climb through here. */
function climbsThrough(grid: Grid, room: Room, x: number): boolean {
  if (tileAt(grid, x, room.floorY) === 'door') return true
  for (let y = room.y; y <= room.floorY + 1; y += 1) if (tileAt(grid, x, y) === 'ladder') return true
  return false
}

/** Places where people pass through: both ends of the room, ladders and stair landings. */
export function passages(site: SiteDraft, room: Room): Span[] {
  const right = room.x + room.w
  const zones: Span[] = [
    { from: room.x - CLEARANCE, to: room.x + CLEARANCE },
    { from: right - CLEARANCE, to: right + CLEARANCE },
  ]
  for (let x = room.x; x < right; x += 1) {
    if (climbsThrough(site.grid, room, x)) zones.push({ from: x - CLEARANCE, to: x + 1 + CLEARANCE })
  }
  for (const well of site.stairwells) {
    if (!well.stops.includes(room.floorY)) continue
    for (const x of [well.leftX, well.rightX]) {
      if (x >= room.x && x <= right) zones.push({ from: x - CLEARANCE, to: x + CLEARANCE })
    }
  }
  return zones
}

/** The stretches of a room's floor where furniture may stand. */
export function floorSpans(site: SiteDraft, room: Room): Span[] {
  const spans: Span[] = []
  let start: number | null = null
  for (let x = room.x; x <= room.x + room.w; x += 1) {
    const ok = x < room.x + room.w && usableColumn(site.grid, room, x)
    if (ok && start === null) start = x
    if (!ok && start !== null) {
      spans.push({ from: start, to: x })
      start = null
    }
  }
  return subtract(spans, passages(site, room)).filter((span) => span.to - span.from >= 0.4)
}

function subtract(spans: Span[], zones: Span[]): Span[] {
  let result = spans
  for (const zone of zones) {
    result = result.flatMap((span) => {
      if (zone.to <= span.from || zone.from >= span.to) return [span]
      const parts: Span[] = []
      if (zone.from > span.from) parts.push({ from: span.from, to: zone.from })
      if (zone.to < span.to) parts.push({ from: zone.to, to: span.to })
      return parts
    })
  }
  return result
}

/** Which ends of the room open onto a doorway or archway, for light switches. */
export function doorwaySides(site: SiteDraft, room: Room): (1 | -1)[] {
  const sides: (1 | -1)[] = []
  for (const [side, x] of [[-1, room.x - 1], [1, room.x + room.w]] as const) {
    const kind = tileAt(site.grid, x, room.floorY - 1)
    if (kind === 'door' || !isSolidAt(site.grid, x, room.floorY - 1)) sides.push(side)
  }
  return sides
}
