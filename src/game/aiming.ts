import type { Guard } from './guards'
import type { GunDef } from './guns'
import { blocksLaneAt, tileAt, TILE_DEFS } from './tiles'
import type { Vec } from './types'
import type { World } from './world'

/** A wall in the walking lane is real cover; scenery beside the lane is not. */
export function shotBlock(world: World, from: Vec, to: Vec): Vec | null {
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.ceil(length / 0.2)
  for (let step = 1; step <= steps; step += 1) {
    const at = { x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps }
    if (Math.floor(at.x) === Math.floor(from.x) && Math.floor(at.y) === Math.floor(from.y)) continue
    if (blocksLaneAt(world.grid, at.x, at.y) && TILE_DEFS[tileAt(world.grid, Math.floor(at.x), Math.floor(at.y))].stopsShots) return at
  }
  return null
}

/** Small, local forgiveness around people; never pulls the aim across a wall or onto a distant guard. */
export function resolveAim(world: World, from: Vec, cursor: Vec): { point: Vec; guard: Guard | null } {
  let closest = 0.55
  let target: Guard | null = null
  let point = cursor
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || guard.out || guard.hiddenIn !== null) continue
    const dx = Math.max(guard.x - cursor.x, 0, cursor.x - guard.x - guard.w)
    const dy = Math.max(guard.y - cursor.y, 0, cursor.y - guard.y - guard.h)
    const gap = Math.hypot(dx, dy)
    if (gap >= closest) continue
    const at = {
      x: Math.max(guard.x + guard.w * 0.3, Math.min(guard.x + guard.w * 0.7, cursor.x)),
      y: Math.max(guard.y + 0.25, Math.min(guard.y + guard.h - 0.25, cursor.y)),
    }
    if (shotBlock(world, from, at)) continue
    closest = gap
    target = guard
    point = at
  }
  return { point, guard: target }
}

/** Single rounds stay close to the selected point; shotguns retain their short-range pellet cone. */
export function playerShotSpread(gun: GunDef, bloom: number, distance: number): number {
  if (gun.shot.kind === 'rocket') return 0
  const spread = gun.shot.spread + bloom
  return gun.pellets > 1 ? spread : Math.min(spread, Math.atan2(0.18, Math.max(1, distance)))
}
