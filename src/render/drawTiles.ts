import { TILE_DEFS, tileAt, type Grid, type TileKind } from '../game/tiles'
import type { Rect } from '../game/types'
import type { Camera } from './camera'

const BACK_WALL = '#1b1d26'

/** Cheap repeatable noise so each tile gets a slightly different shade. */
function shadeOf(x: number, y: number): number {
  return (((x * 73856093) ^ (y * 19349663)) >>> 0) % 5
}

export function drawBackWalls(context: CanvasRenderingContext2D, interiors: Rect[]): void {
  context.fillStyle = BACK_WALL
  for (const area of interiors) context.fillRect(area.x, area.y, area.w, area.h)
}

export function drawTiles(context: CanvasRenderingContext2D, grid: Grid, camera: Camera): void {
  const halfWide = camera.width / camera.scale / 2 + 1
  const halfTall = camera.height / camera.scale / 2 + 1
  const x0 = Math.max(0, Math.floor(camera.x - halfWide))
  const x1 = Math.min(grid.width - 1, Math.ceil(camera.x + halfWide))
  const y0 = Math.max(0, Math.floor(camera.y - halfTall))
  const y1 = Math.min(grid.height - 1, Math.ceil(camera.y + halfTall))

  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const kind = tileAt(grid, x, y)
      if (kind !== 'air') drawTile(context, grid, kind, x, y)
    }
  }
}

function drawTile(context: CanvasRenderingContext2D, grid: Grid, kind: TileKind, x: number, y: number): void {
  const def = TILE_DEFS[kind]
  if (kind === 'ladder') {
    context.fillStyle = def.color
    context.fillRect(x + 0.15, y, 0.12, 1)
    context.fillRect(x + 0.73, y, 0.12, 1)
    context.fillRect(x + 0.15, y + 0.2, 0.7, 0.1)
    context.fillRect(x + 0.15, y + 0.65, 0.7, 0.1)
    return
  }

  context.globalAlpha = kind === 'water' ? 0.55 : kind === 'glass' ? 0.45 : 1
  context.fillStyle = def.color
  context.fillRect(x, y, 1.02, 1.02)
  context.globalAlpha = 1

  if (kind === 'water' || kind === 'glass') return
  context.fillStyle = `rgba(0,0,0,${shadeOf(x, y) * 0.035})`
  context.fillRect(x, y, 1.02, 1.02)
  if (kind === 'door') {
    context.fillStyle = '#5a3d10'
    context.fillRect(x + 0.4, y, 0.2, 1.02)
  }

  // Darken tiles as they take damage, so the player can see a wall is about to give.
  const health = grid.hp[y * grid.width + x] / def.hp
  if (Number.isFinite(def.hp) && health < 1) {
    context.fillStyle = `rgba(0,0,0,${(1 - health) * 0.55})`
    context.fillRect(x, y, 1.02, 1.02)
  }
}
