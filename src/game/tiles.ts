export const TILE_KINDS = ['air', 'dirt', 'brick', 'concrete', 'steel', 'glass', 'wood', 'ladder', 'door', 'water', 'bedrock'] as const
export type TileKind = (typeof TILE_KINDS)[number]

type TileDef = { solid: boolean; opaque: boolean; hp: number; color: string }

/** Everything except bedrock and water can be destroyed. */
export const TILE_DEFS: Record<TileKind, TileDef> = {
  air: { solid: false, opaque: false, hp: 0, color: '' },
  dirt: { solid: true, opaque: true, hp: 30, color: '#6b4a2f' },
  brick: { solid: true, opaque: true, hp: 60, color: '#9a4b3c' },
  concrete: { solid: true, opaque: true, hp: 120, color: '#8d9199' },
  steel: { solid: true, opaque: true, hp: 400, color: '#4b5563' },
  glass: { solid: true, opaque: false, hp: 5, color: '#9fd8e8' },
  wood: { solid: true, opaque: true, hp: 25, color: '#a9783f' },
  ladder: { solid: false, opaque: false, hp: 15, color: '#c9a15a' },
  door: { solid: true, opaque: true, hp: 50, color: '#e0a83a' },
  water: { solid: false, opaque: false, hp: Number.POSITIVE_INFINITY, color: '#2f6f8f' },
  bedrock: { solid: true, opaque: true, hp: Number.POSITIVE_INFINITY, color: '#1f2227' },
}

/** Tiles are grouped into square chunks so drawing code can redo only the parts that changed. `version` goes up on every change. */
export const CHUNK_TILES = 16

export type Grid = { width: number; height: number; kinds: Uint8Array; hp: Float32Array; dirtyChunks: Set<number>; version: number }

export function createGrid(width: number, height: number): Grid {
  return { width, height, kinds: new Uint8Array(width * height), hp: new Float32Array(width * height), dirtyChunks: new Set(), version: 0 }
}

export function inBounds(grid: Grid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height
}

/** Outside the map counts as bedrock, so nothing can leave the world. */
export function tileAt(grid: Grid, x: number, y: number): TileKind {
  if (!inBounds(grid, x, y)) return 'bedrock'
  return TILE_KINDS[grid.kinds[y * grid.width + x]]
}

export function setTile(grid: Grid, x: number, y: number, kind: TileKind): void {
  if (!inBounds(grid, x, y)) return
  const index = y * grid.width + x
  grid.kinds[index] = TILE_KINDS.indexOf(kind)
  grid.hp[index] = TILE_DEFS[kind].hp
  markDirty(grid, x, y)
}

export function chunkIndex(grid: Grid, chunkX: number, chunkY: number): number {
  return chunkY * Math.ceil(grid.width / CHUNK_TILES) + chunkX
}

/** Flags the tile's chunk, and its neighbours' when the tile sits on a chunk edge, since edges shade each other. */
function markDirty(grid: Grid, x: number, y: number): void {
  grid.version += 1
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (!inBounds(grid, x + dx, y + dy)) continue
    grid.dirtyChunks.add(chunkIndex(grid, Math.floor((x + dx) / CHUNK_TILES), Math.floor((y + dy) / CHUNK_TILES)))
  }
}

export function fillTiles(grid: Grid, x0: number, y0: number, x1: number, y1: number, kind: TileKind): void {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) setTile(grid, x, y, kind)
}

export function isSolidAt(grid: Grid, x: number, y: number): boolean {
  return TILE_DEFS[tileAt(grid, Math.floor(x), Math.floor(y))].solid
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
