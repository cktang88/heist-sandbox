import { TILE_DEFS, tileAt, type Grid, type TileKind } from './tiles'
import type { Vec } from './types'

export type RayHit = { tileX: number; tileY: number; distance: number; kind: TileKind }

/** Walks a ray through the grid and returns the first tile the caller wants to stop at. */
export function castRay(grid: Grid, from: Vec, direction: Vec, maxDistance: number, stopsAt: (kind: TileKind) => boolean): RayHit | null {
  const step = 0.1
  for (let travelled = 0; travelled <= maxDistance; travelled += step) {
    const tileX = Math.floor(from.x + direction.x * travelled)
    const tileY = Math.floor(from.y + direction.y * travelled)
    const kind = tileAt(grid, tileX, tileY)
    if (stopsAt(kind)) return { tileX, tileY, distance: travelled, kind }
  }
  return null
}

export function hasLineOfSight(grid: Grid, from: Vec, to: Vec): boolean {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  if (length < 0.001) return true
  const direction = { x: (to.x - from.x) / length, y: (to.y - from.y) / length }
  return castRay(grid, from, direction, length, (kind) => TILE_DEFS[kind].opaque) === null
}

export function normalize(x: number, y: number): Vec {
  const length = Math.hypot(x, y)
  return length < 0.0001 ? { x: 1, y: 0 } : { x: x / length, y: y / length }
}
