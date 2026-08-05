import type { Point } from './types'

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index]
    const b = polygon[previous]
    if ((a.z > point.z) !== (b.z > point.z)
      && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export function distanceToPolygon(point: Point, polygon: readonly Point[]): number {
  if (pointInPolygon(point, polygon)) return 0
  return distanceToPolygonBoundary(point, polygon)
}

export function distanceToPolygonBoundary(point: Point, polygon: readonly Point[]): number {
  let closest = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    closest = Math.min(closest, distanceToSegment(point, polygon[index], polygon[(index + 1) % polygon.length]))
  }
  return closest
}

export function polygonArea(polygon: readonly Point[]): number {
  let twiceArea = 0
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    twiceArea += current.x * next.z - next.x * current.z
  }
  return Math.abs(twiceArea) / 2
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.z - start.z)
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
  return Math.hypot(point.x - (start.x + dx * amount), point.z - (start.z + dz * amount))
}
