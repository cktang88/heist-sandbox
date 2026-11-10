export const TILE_KINDS = ['air', 'dirt', 'brick', 'concrete', 'steel', 'glass', 'wood', 'ladder', 'door', 'water', 'bedrock', 'reinforced', 'fence', 'duct'] as const
export type TileKind = (typeof TILE_KINDS)[number]

/** `stopsShots` is false for things a bullet passes through even though a body cannot, such as chain-link fence. */
type TileDef = { solid: boolean; opaque: boolean; hp: number; color: string; stopsShots: boolean }

/**
 * Everything except bedrock, water and reinforced structure can be destroyed.
 * `reinforced` is a building's skeleton: columns, stair cores and shaft walls that keep it standing.
 */
export const TILE_DEFS: Record<TileKind, TileDef> = {
  air: { solid: false, opaque: false, hp: 0, color: '', stopsShots: false },
  dirt: { solid: true, opaque: true, hp: 30, color: '#6b4a2f', stopsShots: true },
  brick: { solid: true, opaque: true, hp: 60, color: '#9a4b3c', stopsShots: true },
  concrete: { solid: true, opaque: true, hp: 120, color: '#8d9199', stopsShots: true },
  steel: { solid: true, opaque: true, hp: 400, color: '#4b5563', stopsShots: true },
  glass: { solid: true, opaque: false, hp: 5, color: '#9fd8e8', stopsShots: true },
  wood: { solid: true, opaque: true, hp: 25, color: '#a9783f', stopsShots: true },
  ladder: { solid: false, opaque: false, hp: 15, color: '#c9a15a', stopsShots: false },
  door: { solid: true, opaque: true, hp: 50, color: '#e0a83a', stopsShots: true },
  water: { solid: false, opaque: false, hp: Number.POSITIVE_INFINITY, color: '#2f6f8f', stopsShots: false },
  bedrock: { solid: true, opaque: true, hp: Number.POSITIVE_INFINITY, color: '#1f2227', stopsShots: true },
  reinforced: { solid: true, opaque: true, hp: Number.POSITIVE_INFINITY, color: '#6f747c', stopsShots: true },
  fence: { solid: true, opaque: false, hp: 40, color: '#5b6470', stopsShots: false },
  duct: { solid: true, opaque: true, hp: 30, color: '#7d8793', stopsShots: true },
}

/** Tiles are grouped into square chunks so drawing code can redo only the parts that changed. `version` goes up on every change. */
export const CHUNK_TILES = 16

/**
 * `lane` holds, per tile, flags for how it sits in depth (see `CLEAR_OF_LANE` and `RUBBLE`). Setting a tile clears
 * them: a new tile is full depth until whoever placed it says otherwise.
 */
export type Grid = {
  width: number
  height: number
  kinds: Uint8Array
  hp: Float32Array
  lane: Uint8Array
  dirtyChunks: Set<number>
  version: number
  changes: TileChanges
}

/**
 * The indices of tiles whose kind has changed, oldest first, so systems that react to destruction look only at what
 * changed instead of the whole grid. Each reader keeps its own position (`changeMark`) and reads on from it with
 * `changesFrom`. `stepWorld` calls `forgetSeenChanges` at the end of every step, which drops the changes that were
 * already listed at the previous call: by then every system that runs each step has had a full step to see them.
 */
export type TileChanges = {
  tiles: number[]
  /** How many changes have been dropped from the front of `tiles` since the grid was made. */
  dropped: number
  /** The mark at the last `forgetSeenChanges`: what the next call drops. */
  seenUpTo: number
}

/**
 * The tile stands beside the walking lane in depth (a low heap of rubble, a post, a shaft wall behind the corridor):
 * it still stops shots, sight and falling tiles and holds things up, but nothing moving along the lane bumps into it.
 */
export const CLEAR_OF_LANE = 1
/** The tile is fallen rubble that came to rest, not part of the building. */
export const RUBBLE = 2

export function createGrid(width: number, height: number): Grid {
  const size = width * height
  return {
    width,
    height,
    kinds: new Uint8Array(size),
    hp: new Float32Array(size),
    lane: new Uint8Array(size),
    dirtyChunks: new Set(),
    version: 0,
    changes: { tiles: [], dropped: 0, seenUpTo: 0 },
  }
}

/** A reader's position in the change list: everything changed so far is before it. */
export function changeMark(grid: Grid): number {
  return grid.changes.dropped + grid.changes.tiles.length
}

/**
 * Where in `grid.changes.tiles` the changes after `mark` start, or -1 when some of them have already been dropped
 * (the reader has not looked for over a step), in which case it must look at the whole grid.
 */
export function changesFrom(grid: Grid, mark: number): number {
  const at = mark - grid.changes.dropped
  return at < 0 ? -1 : Math.min(at, grid.changes.tiles.length)
}

/** Drops the changes every system has had a step to see. Called once at the end of each step. */
export function forgetSeenChanges(grid: Grid): void {
  const changes = grid.changes
  const seen = changes.seenUpTo - changes.dropped
  if (seen > 0) {
    // Shifted by hand: splice would allocate an array of the dropped entries.
    const { tiles } = changes
    for (let index = seen; index < tiles.length; index += 1) tiles[index - seen] = tiles[index]
    tiles.length -= seen
    changes.dropped += seen
  }
  changes.seenUpTo = changeMark(grid)
}

/** Drops every change listed so far: building a site sets every tile, and nothing has to react to that. */
export function forgetAllChanges(grid: Grid): void {
  grid.changes.dropped += grid.changes.tiles.length
  grid.changes.tiles.length = 0
  grid.changes.seenUpTo = grid.changes.dropped
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height
}

/** Outside the map counts as bedrock, so nothing can leave the world. */
export function tileAt(grid: Grid, x: number, y: number): TileKind {
  if (!inBounds(grid, x, y)) return 'bedrock'
  return TILE_KINDS[grid.kinds[y * grid.width + x]]
}

/** Each kind's number in `Grid.kinds`. */
const TILE_CODES = Object.fromEntries(TILE_KINDS.map((kind, code) => [kind, code])) as Record<TileKind, number>

export function setTile(grid: Grid, x: number, y: number, kind: TileKind): void {
  if (!inBounds(grid, x, y)) return
  const index = y * grid.width + x
  const code = TILE_CODES[kind]
  if (grid.kinds[index] !== code) grid.changes.tiles.push(index)
  grid.kinds[index] = code
  grid.hp[index] = TILE_DEFS[kind].hp
  grid.lane[index] = 0
  markDirty(grid, x, y)
}

/** Sets or clears depth flags on a tile (see `CLEAR_OF_LANE`). Counts as a change, so walk-past maps are redone. */
export function setLaneFlags(grid: Grid, x: number, y: number, flags: number): void {
  if (!inBounds(grid, x, y)) return
  const index = y * grid.width + x
  if (grid.lane[index] === flags) return
  grid.lane[index] = flags
  markDirty(grid, x, y)
}

const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))

/** True when a body moving along the walking lane bumps into this tile: solid, and not standing aside in depth. */
export function blocksLaneAt(grid: Grid, x: number, y: number): boolean {
  const column = Math.floor(x)
  const row = Math.floor(y)
  if (!inBounds(grid, column, row)) return true
  const index = row * grid.width + column
  return SOLID[grid.kinds[index]] === 1 && (grid.lane[index] & CLEAR_OF_LANE) === 0
}

export function chunkIndex(grid: Grid, chunkX: number, chunkY: number): number {
  return chunkY * Math.ceil(grid.width / CHUNK_TILES) + chunkX
}

/** Flags the tile's chunk, and its neighbours' when the tile sits on a chunk edge, since edges shade each other. */
function markDirty(grid: Grid, x: number, y: number): void {
  grid.version += 1
  const chunkX = Math.floor(x / CHUNK_TILES)
  const chunkY = Math.floor(y / CHUNK_TILES)
  grid.dirtyChunks.add(chunkIndex(grid, chunkX, chunkY))
  // Only a tile on the edge of its chunk has a neighbour in another chunk; inside, the one chunk is all there is.
  const column = x - chunkX * CHUNK_TILES
  const row = y - chunkY * CHUNK_TILES
  if (column === 0 && x > 0) grid.dirtyChunks.add(chunkIndex(grid, chunkX - 1, chunkY))
  if (column === CHUNK_TILES - 1 && x + 1 < grid.width) grid.dirtyChunks.add(chunkIndex(grid, chunkX + 1, chunkY))
  if (row === 0 && y > 0) grid.dirtyChunks.add(chunkIndex(grid, chunkX, chunkY - 1))
  if (row === CHUNK_TILES - 1 && y + 1 < grid.height) grid.dirtyChunks.add(chunkIndex(grid, chunkX, chunkY + 1))
}

export function fillTiles(grid: Grid, x0: number, y0: number, x1: number, y1: number, kind: TileKind): void {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) setTile(grid, x, y, kind)
}

export function isSolidAt(grid: Grid, x: number, y: number): boolean {
  return TILE_DEFS[tileAt(grid, Math.floor(x), Math.floor(y))].solid
}

export function stopsShotsAt(grid: Grid, x: number, y: number): boolean {
  return TILE_DEFS[tileAt(grid, Math.floor(x), Math.floor(y))].stopsShots
}

export function isOpaqueAt(grid: Grid, x: number, y: number): boolean {
  return TILE_DEFS[tileAt(grid, Math.floor(x), Math.floor(y))].opaque
}

/** Hurts one tile. Returns the kind that was destroyed, or null if it survived. */
export function damageTile(grid: Grid, x: number, y: number, amount: number): TileKind | null {
  if (!inBounds(grid, x, y) || amount <= 0) return null
  const index = y * grid.width + x
  const kind = TILE_KINDS[grid.kinds[index]]
  if (kind === 'air' || !Number.isFinite(TILE_DEFS[kind].hp)) return null
  grid.hp[index] -= amount
  if (grid.hp[index] > 0) {
    markDirty(grid, x, y)
    return null
  }
  setTile(grid, x, y, 'air')
  return kind
}
