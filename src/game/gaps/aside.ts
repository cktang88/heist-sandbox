import { doorColumn, DOOR_HEIGHT } from '../elevators'
import type { ElevatorShaft, Interior } from '../site'
import { CLEAR_OF_LANE, setLaneFlags, TILE_KINDS, TILE_DEFS, type Grid, type TileKind } from '../tiles'

/**
 * Built things that stand beside the walking lane in depth, though the side view draws them across it: the wall of an
 * elevator shaft (people walk past in front of its doors), and posts standing free outdoors, like a watchtower's legs.
 * They keep stopping shots and sight; people simply walk past them.
 */

/** What a site needs to say where these are. Both `Level` and `World` fit. */
export type AsideSource = { grid: Grid; interiors: readonly Interior[]; elevators?: readonly ElevatorShaft[] }

/** A post must stand at least this tall, so a lone block of rubble or a step is not taken for one. */
const MIN_POST_HEIGHT = 3
/** Materials a free-standing post can be made of. Fences, doors and glass are things people go through on purpose. */
const POST_KINDS: readonly TileKind[] = ['reinforced', 'steel', 'concrete', 'brick', 'wood']
const POST = Uint8Array.from(TILE_KINDS, (kind) => (POST_KINDS.includes(kind) ? 1 : 0))
const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))

/** Flags everything built beside the lane on a freshly built site. */
export function markAside(site: AsideSource): void {
  for (const shaft of site.elevators ?? []) for (const stop of shaft.stops) clearShaftDoorway(site.grid, shaft, stop)
  markPosts(site)
}

/** The doorway of a shaft at one stop is at the back of the corridor: people walk past its closed doors. */
export function clearShaftDoorway(grid: Grid, shaft: ElevatorShaft, stop: number): void {
  const x = doorColumn(shaft)
  for (let y = stop - DOOR_HEIGHT; y < stop; y += 1) if (SOLID[grid.kinds[y * grid.width + x]]) setLaneFlags(grid, x, y, CLEAR_OF_LANE)
}

/** One-tile-wide columns standing on the ground outdoors, with open air on both sides all the way up. */
function markPosts(site: AsideSource): void {
  const { grid } = site
  for (let x = 1; x < grid.width - 1; x += 1) {
    let top = -1
    for (let y = 1; y < grid.height; y += 1) {
      const index = y * grid.width + x
      const post = POST[grid.kinds[index]] === 1 && SOLID[grid.kinds[index - 1]] === 0 && SOLID[grid.kinds[index + 1]] === 0
      if (post) {
        if (top < 0) top = y
        continue
      }
      if (top >= 0 && SOLID[grid.kinds[index]] === 1 && y - top >= MIN_POST_HEIGHT && !indoors(site, x, top)) {
        for (let row = top; row < y; row += 1) setLaneFlags(grid, x, row, CLEAR_OF_LANE)
      }
      top = -1
    }
  }
}

function indoors(site: AsideSource, x: number, y: number): boolean {
  return site.interiors.some((area) => area.kind === 'room' && x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h)
}
