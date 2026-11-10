import type { Vec } from '../types'

/**
 * Things bucketed by the tiles they reach, so a bullet asks only about the tile it is in instead of scanning
 * every lamp or device on the site each step. Built once per list and rebuilt only if the list is replaced or
 * changes length.
 */
type Index<T> = { count: number; byTile: Map<number, T[]> }

/** Tile coordinates packed into one number. Wide enough for any site, negative rows included. */
function key(x: number, y: number): number {
  return (y + 4096) * 8192 + (x + 4096)
}

export function makeTileIndex<T extends object>(tilesOf: (item: T) => Vec[]): (items: readonly T[], x: number, y: number) => readonly T[] {
  const cache = new WeakMap<readonly T[], Index<T>>()
  const none: readonly T[] = []
  return (items, x, y) => {
    let index = cache.get(items)
    if (!index || index.count !== items.length) {
      const byTile = new Map<number, T[]>()
      for (const item of items) {
        for (const tile of tilesOf(item)) {
          const bucket = byTile.get(key(tile.x, tile.y))
          if (bucket) bucket.push(item)
          else byTile.set(key(tile.x, tile.y), [item])
        }
      }
      index = { count: items.length, byTile }
      cache.set(items, index)
    }
    return index.byTile.get(key(Math.floor(x), Math.floor(y))) ?? none
  }
}

/** Every tile a circle touches (its bounding square). */
export function tilesAround(at: Vec, radius: number): Vec[] {
  const tiles: Vec[] = []
  for (let y = Math.floor(at.y - radius); y <= Math.floor(at.y + radius); y += 1) {
    for (let x = Math.floor(at.x - radius); x <= Math.floor(at.x + radius); x += 1) tiles.push({ x, y })
  }
  return tiles
}
