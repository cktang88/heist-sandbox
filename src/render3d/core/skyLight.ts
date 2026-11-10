import { TILE_DEFS, TILE_KINDS, type Grid, type TileKind } from '../../game/tiles'

/**
 * How much open sky each tile can see, worked out by casting a fan of rays upward through the tile grid.
 * The grid is its own acceleration structure: a ray is a walk from cell to cell, so this stays exact as walls
 * are blown apart. It runs on the CPU once per level and again for the area around fresh damage.
 *
 * The renderer uses it to keep sky light (the environment map and hemisphere fill) out of enclosed rooms,
 * which the cut-open front of the building would otherwise flood with it.
 */

/** Rays reaching this far without hitting anything count as open sky. In tiles. */
export const RAY_REACH = 30
/** Ray angles, measured from the horizontal. Spread over the upper half, denser near vertical like real skylight. */
const RAY_ANGLES = [14, 32, 52, 72, 90, 108, 128, 148, 166].map((degrees) => (degrees * Math.PI) / 180)
const RAY_WEIGHTS = RAY_ANGLES.map((angle) => 0.35 + Math.sin(angle))
const WEIGHT_SUM = RAY_WEIGHTS.reduce((sum, weight) => sum + weight, 0)
/** How much light passes through tiles that are solid but not opaque. */
const PASSES: Partial<Record<TileKind, number>> = { glass: 0.7, fence: 0.85 }
/** Solid tiles take the sky light of their most open neighbour, a little dimmer, so wall faces match the air beside them. */
const WALL_FACE = 0.92

/** Light passing through each tile kind, by kind index. */
const TRANSMIT = TILE_KINDS.map((kind) => (TILE_DEFS[kind].opaque ? 0 : PASSES[kind] ?? 1))

export type SkyMap = { width: number; height: number; values: Uint8Array }

export function createSkyMap(grid: Grid): SkyMap {
  const map = { width: grid.width, height: grid.height, values: new Uint8Array(grid.width * grid.height) }
  updateSkyMap(map, grid, 0, 0, grid.width - 1, grid.height - 1)
  return map
}

/** Recomputes the rectangle of tiles (inclusive), then the wall faces just around it. */
export function updateSkyMap(map: SkyMap, grid: Grid, x0: number, y0: number, x1: number, y1: number): void {
  const left = Math.max(0, x0)
  const right = Math.min(grid.width - 1, x1)
  const top = Math.max(0, y0)
  const bottom = Math.min(grid.height - 1, y1)
  const open = new Float32Array((right - left + 1) * (bottom - top + 1))
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const kind = grid.kinds[y * grid.width + x]
      open[(y - top) * (right - left + 1) + (x - left)] = TRANSMIT[kind] > 0 ? skyVisibility(grid, x, y) * TRANSMIT[kind] : -1
    }
  }
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const own = open[(y - top) * (right - left + 1) + (x - left)]
      map.values[y * grid.width + x] = Math.round(255 * (own >= 0 ? own : wallFace(map, grid, open, left, top, right, bottom, x, y)))
    }
  }
}

/** A solid tile shows the sky light of the air next to it, read from this pass where it was just computed. */
function wallFace(map: SkyMap, grid: Grid, open: Float32Array, left: number, top: number, right: number, bottom: number, x: number, y: number): number {
  let best = 0
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx
    const ny = y + dy
    if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue
    const inside = nx >= left && nx <= right && ny >= top && ny <= bottom
    const value = inside ? open[(ny - top) * (right - left + 1) + (nx - left)] : TRANSMIT[grid.kinds[ny * grid.width + nx]] > 0 ? map.values[ny * grid.width + nx] / 255 : -1
    best = Math.max(best, value)
  }
  return best * WALL_FACE
}

/** Weighted share of rays from the centre of a tile that get out to open sky. */
export function skyVisibility(grid: Grid, x: number, y: number): number {
  let total = 0
  for (let ray = 0; ray < RAY_ANGLES.length; ray += 1) {
    total += RAY_WEIGHTS[ray] * traceRay(grid, x + 0.5, y + 0.5, Math.cos(RAY_ANGLES[ray]), -Math.sin(RAY_ANGLES[ray]))
  }
  return total / WEIGHT_SUM
}

/** Walks the grid cell by cell (a DDA) and returns how much light survives. Leaving the top of the map is open sky. */
function traceRay(grid: Grid, startX: number, startY: number, dx: number, dy: number): number {
  let cellX = Math.floor(startX)
  let cellY = Math.floor(startY)
  const stepX = dx > 0 ? 1 : -1
  const stepY = dy > 0 ? 1 : -1
  const across = Math.abs(dx) < 1e-6 ? Infinity : Math.abs(1 / dx)
  const down = Math.abs(dy) < 1e-6 ? Infinity : Math.abs(1 / dy)
  let nextX = Math.abs(dx) < 1e-6 ? Infinity : (dx > 0 ? cellX + 1 - startX : startX - cellX) * across
  let nextY = Math.abs(dy) < 1e-6 ? Infinity : (dy > 0 ? cellY + 1 - startY : startY - cellY) * down
  let light = 1
  for (;;) {
    if (nextX < nextY) {
      if (nextX > RAY_REACH) return light
      cellX += stepX
      nextX += across
    } else {
      if (nextY > RAY_REACH) return light
      cellY += stepY
      nextY += down
    }
    // Past the top or the sides of the map there is only sky.
    if (cellY < 0 || cellX < 0 || cellX >= grid.width) return light
    if (cellY >= grid.height) return 0
    light *= TRANSMIT[grid.kinds[cellY * grid.width + cellX]]
    if (light < 0.02) return 0
  }
}
