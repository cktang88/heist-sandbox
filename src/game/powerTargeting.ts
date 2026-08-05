import type { Point } from './types'

export const POWER_DRAG_THRESHOLD = 0.25

/** A short click keeps the original full-width horizontal targeting behavior. */
export function resolvePowerLine(start: Point, end: Point, mapWidth: number): { start: Point; end: Point } {
  if (Math.hypot(end.x - start.x, end.z - start.z) >= POWER_DRAG_THRESHOLD) return { start, end }
  return {
    start: { x: -mapWidth / 2, z: start.z },
    end: { x: mapWidth / 2, z: start.z },
  }
}

/** Tests a finite, rounded lane (a line segment with a radius). */
export function isPointInPowerLane(point: Point, start: Point, end: Point | undefined, halfWidth: number): boolean {
  if (!end) return Math.abs(point.z - start.z) <= halfWidth
  return distanceToSegment(point, start, end) <= halfWidth
}

export function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared <= 0.000001) return Math.hypot(point.x - start.x, point.z - start.z)
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
  return Math.hypot(point.x - (start.x + dx * amount), point.z - (start.z + dz * amount))
}
