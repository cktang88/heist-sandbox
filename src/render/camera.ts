import type { Grid } from '../game/tiles'
import type { Vec } from '../game/types'

/** Where the view is looking. x,y is the centre in tile units; scale is pixels per tile. */
export type Camera = { x: number; y: number; scale: number; width: number; height: number }

const TILES_TALL = 24

export function createCamera(width: number, height: number, focus: Vec, grid: Grid): Camera {
  const scale = height / TILES_TALL
  const halfWide = width / scale / 2
  const halfTall = TILES_TALL / 2
  return {
    x: Math.max(halfWide, Math.min(grid.width - halfWide, focus.x)),
    y: Math.max(halfTall, Math.min(grid.height - halfTall, focus.y)),
    scale, width, height,
  }
}

export function screenToWorld(camera: Camera, screenX: number, screenY: number): Vec {
  return { x: (screenX - camera.width / 2) / camera.scale + camera.x, y: (screenY - camera.height / 2) / camera.scale + camera.y }
}
