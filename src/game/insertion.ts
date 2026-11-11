import { blocksLaneAt } from './tiles'
import type { Vec } from './types'
import type { World } from './world'

/** First surface a straight parachute descent reaches, using the same depth rules as player physics. */
export function dropPointAt(world: World, requestedX: number): Vec {
  const fallback = world.player.x + world.player.w / 2
  const x = Math.floor(Math.max(2, Math.min(world.grid.width - 3, Number.isFinite(requestedX) ? requestedX : fallback))) + 0.5
  for (let y = 1; y < world.grid.height; y += 1) {
    if (blocksLaneAt(world.grid, x, y)) return { x, y }
  }
  return { x, y: world.groundY }
}

/** Set the opening's horizontal entry only; the player still parachutes and steers to the marked surface. */
export function chooseDrop(world: World, x: number): void {
  const point = dropPointAt(world, x)
  world.dropPoint = point
  Object.assign(world.player, {
    x: point.x - world.player.w / 2,
    y: Math.max(1, Math.min(world.player.y, point.y - world.player.h - 18)),
    vx: 0, vy: 0, onGround: false, chute: false,
  })
}
