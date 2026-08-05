import type { Point } from './types'

export type PathInfo = {
  lengths: number[]
  totalLength: number
}

export function buildPathInfo(path: Point[]): PathInfo {
  const lengths = path.slice(1).map((point, index) => distance(point, path[index]))
  return { lengths, totalLength: lengths.reduce((sum, length) => sum + length, 0) }
}

export function pointAlongPath(path: Point[], info: PathInfo, progress: number): Point {
  let remaining = Math.max(0, Math.min(1, progress)) * info.totalLength

  for (let index = 0; index < info.lengths.length; index += 1) {
    const length = info.lengths[index]
    if (remaining <= length) {
      const start = path[index]
      const end = path[index + 1]
      const mix = length === 0 ? 0 : remaining / length
      return { x: start.x + (end.x - start.x) * mix, z: start.z + (end.z - start.z) * mix }
    }
    remaining -= length
  }

  return path[path.length - 1]
}

export function distanceToPath(point: Point, path: Point[]): number {
  let closest = Number.POSITIVE_INFINITY
  for (let index = 0; index < path.length - 1; index += 1) {
    closest = Math.min(closest, distanceToSegment(point, path[index], path[index + 1]))
  }
  return closest
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function distanceToSegment(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz
  if (lengthSquared === 0) return distance(point, start)
  const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
  return distance(point, { x: start.x + amount * dx, z: start.z + amount * dz })
}
