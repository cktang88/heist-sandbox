import type { Interior, Room } from '../site'
import { TILE_DEFS, TILE_KINDS, type Grid, type TileKind } from '../tiles'

/**
 * Holes blasted in a building's floor slabs that a person can still walk past.
 *
 * The side view shows a slab cut open, but the real slab is deep (z from -2.4 to +0.5) and people walk at z = 0.
 * A blast that takes out a tile of slab in the side view leaves the back of the slab standing, so a person can
 * step around the hole in depth, or drop through it on purpose. Only slabs that were built as floor count:
 * shafts, hatches and manholes were built open and stay open, and outdoor ground is not a slab.
 * When too much of a room's slab has gone there is nothing left beside the hole to step on.
 */

/** Slab materials. Doors (hatches), glass (skylights) and ducts in a slab row are fittings, not floor. */
const FLOOR_KINDS: readonly TileKind[] = ['concrete', 'steel', 'wood', 'brick']
const FLOOR = Uint8Array.from(TILE_KINDS, (kind) => (FLOOR_KINDS.includes(kind) ? 1 : 0))
const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))
/** Rooms with no slab of their own to walk past a hole on. */
const OUTDOOR = new Set<Room['kind']>(['street', 'yard', 'rooftop', 'sewer', 'silo'])
/** A row inside an interior is a slab when this share of it is solid and this share of the row above is open. */
const SLAB_SOLID_SHARE = 0.7
const ROOM_OPEN_SHARE = 0.5

/** What a site needs to say where its floor slabs are. Both `Level` and `World` fit. */
export type SlabSource = { grid: Grid; rooms: readonly Room[]; interiors: readonly Interior[]; groundY: number }

export type Holes = {
  /** The grid this was worked out for; a different grid (tests swap it) means starting again. */
  grid: Grid
  /** Tile indices of every slab tile that was floor when the site was built. */
  slabs: Int32Array
  /** For each slab tile, the widest run of missing slab that can still be walked past. */
  widest: Uint16Array
  /** Grid version the walk-past set was last worked out at. */
  version: number
  /** Tile indices of the holes that can be walked past right now. */
  walkable: Set<number>
}

type Segment = { row: number; x0: number; x1: number; width: number }

/** Remembers which tiles were floor, so later holes can be told apart from openings built in. */
export function createHoles(site: SlabSource): Holes {
  const { grid } = site
  const taken = new Uint8Array(grid.width * grid.height)
  const slabs: number[] = []
  const widest: number[] = []
  for (const segment of slabSegments(site)) {
    const limit = Math.max(1, Math.floor(segment.width / 2))
    for (let x = Math.max(0, segment.x0); x <= Math.min(grid.width - 1, segment.x1); x += 1) {
      const index = segment.row * grid.width + x
      if (taken[index] || !FLOOR[grid.kinds[index]]) continue
      taken[index] = 1
      slabs.push(index)
      widest.push(limit)
    }
  }
  return { grid, slabs: Int32Array.from(slabs), widest: Uint16Array.from(widest), version: grid.version, walkable: new Set() }
}

/** Floors of indoor rooms (with the wall columns at each end), or, for a site without rooms, slab rows found in its interiors. */
function slabSegments(site: SlabSource): Segment[] {
  const indoor = site.rooms.filter((room) => !OUTDOOR.has(room.kind) && room.floorY < site.groundY)
  if (site.rooms.length > 0) return indoor.map((room) => ({ row: room.floorY, x0: room.x - 1, x1: room.x + room.w, width: room.w }))
  const segments: Segment[] = []
  for (const interior of site.interiors) {
    if (interior.kind !== 'room') continue
    // The top row is the roof, which is outdoors; the slab under the bottom row is the ground.
    for (let row = interior.y + 1; row < interior.y + interior.h; row += 1) {
      if (isSlabRow(site.grid, interior, row)) segments.push({ row, x0: interior.x, x1: interior.x + interior.w - 1, width: interior.w })
    }
  }
  return segments
}

function isSlabRow(grid: Grid, interior: Interior, row: number): boolean {
  let solid = 0
  let openAbove = 0
  for (let x = interior.x; x < interior.x + interior.w; x += 1) {
    solid += SOLID[grid.kinds[row * grid.width + x]]
    openAbove += 1 - SOLID[grid.kinds[(row - 1) * grid.width + x]]
  }
  return solid >= interior.w * SLAB_SOLID_SHARE && openAbove >= interior.w * ROOM_OPEN_SHARE
}

/** Works out the walk-past holes again if any tile has changed since last time. Cost: one pass over the slab tiles. */
export function refreshHoles(holes: Holes): void {
  const { grid } = holes
  if (grid.version === holes.version) return
  holes.version = grid.version
  holes.walkable.clear()
  for (let entry = 0; entry < holes.slabs.length; entry += 1) {
    const index = holes.slabs[entry]
    if (SOLID[grid.kinds[index]]) continue
    if (openRun(grid, index, holes.widest[entry]) <= holes.widest[entry]) holes.walkable.add(index)
  }
}

/** Length of the run of open tiles along the row through `index`, counting no further than one past `limit`. */
function openRun(grid: Grid, index: number, limit: number): number {
  const x = index % grid.width
  const rowStart = index - x
  let run = 1
  for (let left = x - 1; left >= 0 && run <= limit && !SOLID[grid.kinds[rowStart + left]]; left -= 1) run += 1
  for (let right = x + 1; right < grid.width && run <= limit && !SOLID[grid.kinds[rowStart + right]]; right += 1) run += 1
  return run
}

/** True when the tile at column `x` of slab row `floorY` is a hole a person can walk past. */
export function isWalkableHole(holes: Holes, x: number, floorY: number): boolean {
  const column = Math.floor(x)
  if (column < 0 || column >= holes.grid.width) return false
  return holes.walkable.has(floorY * holes.grid.width + column)
}
