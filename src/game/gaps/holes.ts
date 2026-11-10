import type { ElevatorShaft, Interior, Room } from '../site'
import { TILE_DEFS, TILE_KINDS, type Grid, type TileKind } from '../tiles'

/**
 * Holes blasted in a building's floor slabs that a person can still walk past.
 *
 * The side view shows a slab cut open, but the real slab is deep (z from -2.4 to +0.5) and people walk at z = 0.
 * A blast that takes out a tile of slab in the side view leaves the back of the slab standing, so a person can
 * step around the hole in depth, or drop through it on purpose. Only slabs that were built as floor count, and
 * outdoor ground is not a slab. When too much of a room's slab has gone there is nothing left beside the hole to step on.
 *
 * Two kinds of built opening work the same way. A ladder hatch or manhole is a narrow hole in the front of a floor:
 * people walk past it and take the ladder only by climbing (up or down). An elevator shaft stands behind the corridor
 * at each of its stops: people walk past it in front, and only fall in if they choose to.
 */

/** Slab materials. Doors (hatches), glass (skylights) and ducts in a slab row are fittings, not floor. */
const FLOOR_KINDS: readonly TileKind[] = ['concrete', 'steel', 'wood', 'brick']
const FLOOR = Uint8Array.from(TILE_KINDS, (kind) => (FLOOR_KINDS.includes(kind) ? 1 : 0))
const LADDER = TILE_KINDS.indexOf('ladder')
const DOOR = TILE_KINDS.indexOf('door')
const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))
/** Rooms with no slab of their own to walk past a hole on. */
const OUTDOOR = new Set<Room['kind']>(['street', 'yard', 'rooftop', 'sewer', 'silo'])
/** A row inside an interior is a slab when this share of it is solid and this share of the row above is open. */
const SLAB_SOLID_SHARE = 0.7
const ROOM_OPEN_SHARE = 0.5

/** What a site needs to say where its floor slabs are. Both `Level` and `World` fit. */
export type SlabSource = { grid: Grid; rooms: readonly Room[]; interiors: readonly Interior[]; groundY: number; elevators?: readonly ElevatorShaft[] }

/** Where in depth a person walks past an opening in a floor: on the back strip of a slab, or in front of a shaft. */
export const BUILT_NONE = 0
export const BUILT_SLAB = 1
export const BUILT_SHAFT_LANE = 2
export const BUILT_HATCH = 3

export type Holes = {
  /** The grid this was worked out for; a different grid (tests swap it) means starting again. */
  grid: Grid
  /** Tile indices of every slab tile that was floor when the site was built, with its hatches and shaft lanes. */
  slabs: Int32Array
  /** For every tile of the grid: `BUILT_SLAB`, `BUILT_HATCH`, `BUILT_SHAFT_LANE`, or `BUILT_NONE` for anything that is not walkable floor. */
  built: Uint8Array
  /** For each slab tile, the widest run of missing slab that can still be walked past. */
  widest: Uint16Array
  /** Grid version the walk-past set was last worked out at. */
  version: number
  /** Tile indices of the holes blasted in floors that can be walked past right now. */
  walkable: Set<number>
  /** Tile indices of the built openings (hatches, shaft lanes) that are open and walked past right now. */
  openings: Set<number>
}

type Segment = { row: number; x0: number; x1: number; width: number }

/** Remembers which tiles were floor, so later holes can be told apart from openings built in. */
export function createHoles(site: SlabSource): Holes {
  const { grid } = site
  const built = new Uint8Array(grid.width * grid.height)
  const slabs: number[] = []
  const widest: number[] = []
  const add = (index: number, limit: number, kind: number): void => {
    if (built[index]) return
    built[index] = kind
    slabs.push(index)
    widest.push(limit)
  }
  for (const segment of slabSegments(site)) {
    const limit = Math.max(1, Math.floor(segment.width / 2))
    for (let x = Math.max(0, segment.x0); x <= Math.min(grid.width - 1, segment.x1); x += 1) {
      const index = segment.row * grid.width + x
      if (FLOOR[grid.kinds[index]]) add(index, limit, BUILT_SLAB)
      else if (isHatch(grid, index)) add(index, limit, BUILT_HATCH)
    }
  }
  // Hatches outside the rooms' floors: manholes in the street, the floors of silos and watchtowers.
  for (let index = grid.width; index < grid.kinds.length - grid.width; index += 1) if (isHatch(grid, index)) add(index, 1, BUILT_HATCH)
  for (const shaft of site.elevators ?? []) {
    for (const stop of shaft.stops) {
      for (let x = shaft.x; x < shaft.x + shaft.w; x += 1) add(stop * grid.width + x, shaft.w, BUILT_SHAFT_LANE)
    }
  }
  return { grid, slabs: Int32Array.from(slabs), built, widest: Uint16Array.from(widest), version: -1, walkable: new Set(), openings: new Set() }
}

/**
 * A ladder hatch in a floor: a ladder (or the door that closes it) with the ladder carrying on below, solid floor on
 * both sides, and room to stand on both sides above. A ladder up the side of a shaft has no floor beside it.
 */
function isHatch(grid: Grid, index: number): boolean {
  const kind = grid.kinds[index]
  if ((kind !== LADDER && kind !== DOOR) || grid.kinds[index + grid.width] !== LADDER) return false
  const x = index % grid.width
  if (x === 0 || x === grid.width - 1) return false
  const above = index - grid.width
  return SOLID[grid.kinds[index - 1]] === 1 && SOLID[grid.kinds[index + 1]] === 1
    && SOLID[grid.kinds[above - 1]] === 0 && SOLID[grid.kinds[above + 1]] === 0
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
  holes.openings.clear()
  for (let entry = 0; entry < holes.slabs.length; entry += 1) {
    const index = holes.slabs[entry]
    if (SOLID[grid.kinds[index]]) continue
    if (openRun(grid, index, holes.widest[entry]) > holes.widest[entry]) continue
    if (holes.built[index] === BUILT_SLAB) holes.walkable.add(index)
    else holes.openings.add(index)
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

/** What kind of walkable floor the tile at column `x`, row `floorY` was built as (`BUILT_SLAB`, `BUILT_HATCH`, `BUILT_SHAFT_LANE`, or `BUILT_NONE`). */
export function builtAs(holes: Holes, x: number, floorY: number): number {
  const column = Math.floor(x)
  if (column < 0 || column >= holes.grid.width || floorY < 0 || floorY >= holes.grid.height) return BUILT_NONE
  return holes.built[floorY * holes.grid.width + column]
}

/** True when the tile at column `x` of slab row `floorY` is a hole a person can walk past. */
export function isWalkableHole(holes: Holes, x: number, floorY: number): boolean {
  const column = Math.floor(x)
  if (column < 0 || column >= holes.grid.width) return false
  const index = floorY * holes.grid.width + column
  return holes.walkable.has(index) || holes.openings.has(index)
}

/** True when there is anything at all to walk past: a hole blasted in a floor, or an open hatch or shaft. */
export function anyWalkPast(holes: Holes): boolean {
  return holes.walkable.size > 0 || holes.openings.size > 0
}
