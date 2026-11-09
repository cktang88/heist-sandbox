import type { Interior } from '../game/level'
import { CHUNK_TILES, chunkIndex, TILE_DEFS, tileAt, type Grid } from '../game/tiles'
import type { Camera } from './camera'
import { paintBackWall, paintDamage, paintTile } from './tileArt'

/** Pixels per tile inside a cached chunk. Chunks are scaled smoothly to the screen. */
const TILE_PIXELS = 40
const CHUNK_PIXELS = CHUNK_TILES * TILE_PIXELS

type Chunk = { back: HTMLCanvasElement; front: HTMLCanvasElement }

/**
 * Tiles are painted once into chunk-sized images and reused every frame.
 * Only chunks the game marks dirty (something was damaged) are painted again.
 */
export type TileCache = { draw(context: CanvasRenderingContext2D, camera: Camera, layer: keyof Chunk): void }

export function createTileCache(grid: Grid, interiors: Interior[]): TileCache {
  const chunks = new Map<number, Chunk>()
  grid.dirtyChunks.clear()

  function chunkAt(chunkX: number, chunkY: number): Chunk {
    const index = chunkIndex(grid, chunkX, chunkY)
    let chunk = chunks.get(index)
    if (!chunk) {
      chunk = { back: blank(), front: blank() }
      paintBack(chunk.back, interiors, chunkX, chunkY)
      paintFront(chunk.front, grid, chunkX, chunkY)
      chunks.set(index, chunk)
    } else if (grid.dirtyChunks.has(index)) {
      paintFront(chunk.front, grid, chunkX, chunkY)
    }
    grid.dirtyChunks.delete(index)
    return chunk
  }

  return {
    draw(context, camera, layer) {
      const halfWide = camera.width / camera.scale / 2
      const halfTall = camera.height / camera.scale / 2
      const x0 = Math.max(0, Math.floor((camera.x - halfWide) / CHUNK_TILES))
      const x1 = Math.min(Math.ceil(grid.width / CHUNK_TILES) - 1, Math.floor((camera.x + halfWide) / CHUNK_TILES))
      const y0 = Math.max(0, Math.floor((camera.y - halfTall) / CHUNK_TILES))
      const y1 = Math.min(Math.ceil(grid.height / CHUNK_TILES) - 1, Math.floor((camera.y + halfTall) / CHUNK_TILES))
      for (let chunkY = y0; chunkY <= y1; chunkY += 1) {
        for (let chunkX = x0; chunkX <= x1; chunkX += 1) {
          // Slight overlap hides hairline seams between neighbouring chunks.
          context.drawImage(chunkAt(chunkX, chunkY)[layer], chunkX * CHUNK_TILES, chunkY * CHUNK_TILES, CHUNK_TILES + 0.02, CHUNK_TILES + 0.02)
        }
      }
    },
  }
}

function blank(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = CHUNK_PIXELS
  canvas.height = CHUNK_PIXELS
  return canvas
}

function paintBack(canvas: HTMLCanvasElement, interiors: Interior[], chunkX: number, chunkY: number): void {
  const c = canvas.getContext('2d')!
  for (let row = 0; row < CHUNK_TILES; row += 1) {
    for (let column = 0; column < CHUNK_TILES; column += 1) {
      const tx = chunkX * CHUNK_TILES + column
      const ty = chunkY * CHUNK_TILES + row
      const area = interiors.find((other) => tx >= other.x && tx < other.x + other.w && ty >= other.y && ty < other.y + other.h)
      if (area) paintBackWall(c, area.kind, column * TILE_PIXELS, row * TILE_PIXELS, TILE_PIXELS, tx, ty)
    }
  }
}

function paintFront(canvas: HTMLCanvasElement, grid: Grid, chunkX: number, chunkY: number): void {
  const c = canvas.getContext('2d')!
  const s = TILE_PIXELS
  c.clearRect(0, 0, CHUNK_PIXELS, CHUNK_PIXELS)
  const solid = (x: number, y: number) => TILE_DEFS[tileAt(grid, x, y)].solid

  for (let row = 0; row < CHUNK_TILES; row += 1) {
    for (let column = 0; column < CHUNK_TILES; column += 1) {
      const tx = chunkX * CHUNK_TILES + column
      const ty = chunkY * CHUNK_TILES + row
      const px = column * s
      const py = row * s
      const kind = tileAt(grid, tx, ty)
      const def = TILE_DEFS[kind]

      if (!def.solid) {
        paintContactShadow(c, px, py, s, solid(tx, ty - 1), solid(tx - 1, ty), solid(tx + 1, ty))
        if (kind !== 'air') paintTile(c, kind, px, py, s, tx, ty)
        continue
      }

      paintTile(c, kind, px, py, s, tx, ty)
      const health = grid.hp[ty * grid.width + tx] / def.hp
      if (Number.isFinite(def.hp) && health < 1) paintDamage(c, px, py, s, tx, ty, health)
      if (kind === 'glass') continue
      // Light catches the top edge; the other open edges get a dark outline.
      if (!solid(tx, ty - 1)) fill(c, 'rgba(255,255,255,0.22)', px, py, s, s * 0.07)
      if (!solid(tx, ty + 1)) fill(c, 'rgba(0,0,0,0.45)', px, py + s * 0.9, s, s * 0.1)
      if (!solid(tx - 1, ty)) fill(c, 'rgba(0,0,0,0.3)', px, py, s * 0.06, s)
      if (!solid(tx + 1, ty)) fill(c, 'rgba(0,0,0,0.3)', px + s * 0.94, py, s * 0.06, s)
    }
  }
}

/** Soft shadow in open space next to walls and under ceilings, which gives rooms depth. */
function paintContactShadow(c: CanvasRenderingContext2D, px: number, py: number, s: number, above: boolean, left: boolean, right: boolean): void {
  if (above) gradient(c, px, py, px, py + s * 0.7, px, py, s, s * 0.7, 0.42)
  if (left) gradient(c, px, py, px + s * 0.5, py, px, py, s * 0.5, s, 0.25)
  if (right) gradient(c, px + s, py, px + s * 0.5, py, px + s * 0.5, py, s * 0.5, s, 0.25)
}

function gradient(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number, alpha: number): void {
  const fade = c.createLinearGradient(x0, y0, x1, y1)
  fade.addColorStop(0, `rgba(0,0,0,${alpha})`)
  fade.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = fade
  c.fillRect(rx, ry, rw, rh)
}

function fill(c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number): void {
  c.fillStyle = color
  c.fillRect(x, y, w, h)
}
