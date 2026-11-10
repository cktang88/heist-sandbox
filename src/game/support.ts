import { TILE_DEFS, TILE_KINDS, type Grid } from './tiles'

/**
 * The rules for what holds a tile up, shared by the whole-site check (`findUnsupported` in collapse.ts) and the
 * local one around changed tiles (collapseNear.ts), which must agree exactly.
 */

/** A duct floor sits this many rows under the slab it hangs from (one row of crawl space between). */
export const HANGER_ROWS = 2
/** Rows from one floor slab to the next. */
export const STOREY = 6
export const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))
/** Ladders are bolted to the walls beside them, so they hold the two sides of a shaft together. */
export const CARRIES = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid || kind === 'ladder' ? 1 : 0))
export const DUCT = TILE_KINDS.indexOf('duct')

/**
 * One slab row of a building, columns x0..x1: where floors are also held by the back wall the side view cuts away.
 * `top` and `bottom` are the building's first and last rows, so holding a slab never reaches outside it.
 */
export type SlabRow = { y: number; x0: number; x1: number; top: number; bottom: number }

/** The tiles a standing slab holds from behind: its columns, from the storey above it to the storey below, inside its building. */
export type Band = { x0: number; x1: number; y0: number; y1: number }

export function bandOf(grid: Grid, slab: SlabRow): Band {
  return {
    x0: Math.max(0, slab.x0),
    x1: Math.min(grid.width - 1, slab.x1),
    y0: Math.max(0, slab.top, slab.y - STOREY + 1),
    y1: Math.min(grid.height - 1, slab.bottom, slab.y + STOREY - 1),
  }
}
