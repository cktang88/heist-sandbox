import { isSolidAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import type { Target } from './targets'
import { targetsAt } from './targets'

/**
 * Follows the player's bullets through the things the ballistics code ignores (pipes, sinks, hung fittings) and
 * reports each one hit. A bullet's path since last frame is sampled; a bullet that stopped this frame (in a wall,
 * a body) still has its last stretch checked, up to the first solid tile.
 */
const SAMPLE = 0.25
const MAX_SAMPLES = 12

/** `heading` is the round's direction of travel, so a target can tell a round striking it from one passing below. */
export type HitHandler = (target: Target, at: Vec, heading: Vec) => void

export function followShots(world: World, dt: number, onHit: HitHandler): void {
  const systems = world.systems
  const previous = systems.trails
  if (previous.length === 0 && world.projectiles.length === 0) return
  const live = new Set<object>()
  const trails: typeof previous = []
  for (const shot of world.projectiles) {
    if (shot.kind !== 'bullet' || !shot.fromPlayer) continue
    live.add(shot)
    trails.push({ shot, x: shot.x, y: shot.y, vx: shot.vx, vy: shot.vy })
    sample(world, shot.x - shot.vx * dt, shot.y - shot.vy * dt, shot.x, shot.y, false, onHit)
  }
  for (const trail of previous) {
    if (!live.has(trail.shot)) sample(world, trail.x, trail.y, trail.x + trail.vx * dt, trail.y + trail.vy * dt, true, onHit)
  }
  systems.trails = trails
}

function sample(world: World, x0: number, y0: number, x1: number, y1: number, stopAtWall: boolean, onHit: HitHandler): void {
  const length = Math.hypot(x1 - x0, y1 - y0)
  const steps = Math.min(MAX_SAMPLES, Math.max(1, Math.ceil(length / SAMPLE)))
  for (let step = 0; step <= steps; step += 1) {
    const x = x0 + ((x1 - x0) * step) / steps
    const y = y0 + ((y1 - y0) * step) / steps
    if (stopAtWall && isSolidAt(world.grid, x, y)) return
    for (const target of targetsAt(world, x, y)) onHit(target, { x, y }, { x: x1 - x0, y: y1 - y0 })
  }
}
