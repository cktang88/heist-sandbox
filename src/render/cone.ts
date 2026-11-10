import { visionOf, type Guard } from '../game/guards'
import { isOpaqueAt, type Grid } from '../game/tiles'
import type { Vec } from '../game/types'
import type { World } from '../game/world'

/** How far a ray of light or sight travels before an opaque tile stops it. */
export function reach(grid: Grid, from: Vec, direction: Vec, max: number): number {
  for (let travelled = 0; travelled < max; travelled += 0.2) {
    if (isOpaqueAt(grid, from.x + direction.x * travelled, from.y + direction.y * travelled)) return travelled
  }
  return max
}

export function eyeOf(guard: Guard): Vec {
  return { x: guard.x + guard.w / 2, y: guard.y + 0.35 }
}

/** Outline of what a guard can see, clipped by walls: exactly his central cone. Doubles as the guard's torch beam. */
export function visionCone(world: World, guard: Guard): Vec[] {
  const eye = eyeOf(guard)
  const { angle, halfAngle, range } = visionOf(guard)
  const points: Vec[] = [eye]
  for (let index = 0; index <= 12; index += 1) {
    const turn = angle - halfAngle + (index / 12) * halfAngle * 2
    const direction = { x: Math.cos(turn), y: Math.sin(turn) }
    const distance = Math.min(range, reach(world.grid, eye, direction, range) + 0.7)
    points.push({ x: eye.x + direction.x * distance, y: eye.y + direction.y * distance })
  }
  return points
}

/** Outline of the area a lamp lights, clipped by walls. */
export function lightPolygon(grid: Grid, from: Vec, radius: number): Vec[] {
  const points: Vec[] = []
  for (let index = 0; index < 40; index += 1) {
    const angle = (index / 40) * Math.PI * 2
    const direction = { x: Math.cos(angle), y: Math.sin(angle) }
    const distance = Math.min(radius, reach(grid, from, direction, radius) + 0.9)
    points.push({ x: from.x + direction.x * distance, y: from.y + direction.y * distance })
  }
  return points
}

export function tracePolygon(context: CanvasRenderingContext2D, points: Vec[]): void {
  context.beginPath()
  points.forEach((point, index) => (index === 0 ? context.moveTo(point.x, point.y) : context.lineTo(point.x, point.y)))
  context.closePath()
}
