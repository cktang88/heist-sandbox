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

const LOOK_AHEAD = 0.22
const MAX_LOOK_AHEAD_TILES = 5
const FOLLOW_PER_SECOND = 9

/**
 * Glides the view toward a point between the player and the cursor,
 * so you see more of where you are aiming.
 */
export function followFocus(current: Vec, focus: Vec, aim: Vec, realDt: number): Vec {
  const ahead = { x: (aim.x - focus.x) * LOOK_AHEAD, y: (aim.y - focus.y) * LOOK_AHEAD }
  const length = Math.hypot(ahead.x, ahead.y)
  const cap = length > MAX_LOOK_AHEAD_TILES ? MAX_LOOK_AHEAD_TILES / length : 1
  const ease = 1 - Math.exp(-FOLLOW_PER_SECOND * realDt)
  return {
    x: current.x + (focus.x + ahead.x * cap - current.x) * ease,
    y: current.y + (focus.y + ahead.y * cap - current.y) * ease,
  }
}

export function worldToScreen(camera: Camera, point: Vec): Vec {
  return { x: (point.x - camera.x) * camera.scale + camera.width / 2, y: (point.y - camera.y) * camera.scale + camera.height / 2 }
}

export function screenToWorld(camera: Camera, screenX: number, screenY: number): Vec {
  return { x: (screenX - camera.width / 2) / camera.scale + camera.x, y: (screenY - camera.height / 2) / camera.scale + camera.y }
}
