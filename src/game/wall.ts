import type { MapDefinition, Point } from './types'

export const BASE_WALL_VISUAL_LENGTH = 1.75

export function wallVisualLength(lengthMultiplier: number): number {
  return BASE_WALL_VISUAL_LENGTH * Math.max(1, lengthMultiplier)
}

/**
 * Distance from a point to the wall's added center segment. A baseline wall
 * remains the original circular blocker; length upgrades extend its rotated long axis.
 */
export function distanceToWall(point: Point, wall: Point & { rotation?: number }, lengthMultiplier: number): number {
  const extraHalfLength = (wallVisualLength(lengthMultiplier) - BASE_WALL_VISUAL_LENGTH) / 2
  const rotation = wall.rotation ?? 0
  const axisX = Math.sin(rotation)
  const axisZ = Math.cos(rotation)
  const projection = Math.max(-extraHalfLength, Math.min(extraHalfLength, (point.x - wall.x) * axisX + (point.z - wall.z) * axisZ))
  return Math.hypot(point.x - (wall.x + axisX * projection), point.z - (wall.z + axisZ * projection))
}

/** Rotates the long wall axis perpendicular to the nearest authored path segment. */
export function deriveWallRotation(map: MapDefinition, point: Point): number {
  let closestDistance = Number.POSITIVE_INFINITY
  let rotation = 0
  for (const path of map.paths) {
    for (let index = 0; index < path.length - 1; index += 1) {
      const start = path[index]
      const end = path[index + 1]
      const dx = end.x - start.x
      const dz = end.z - start.z
      const lengthSquared = dx * dx + dz * dz
      if (lengthSquared === 0) continue
      const amount = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
      const offsetX = point.x - (start.x + dx * amount)
      const offsetZ = point.z - (start.z + dz * amount)
      const distanceSquared = offsetX * offsetX + offsetZ * offsetZ
      if (distanceSquared >= closestDistance) continue
      closestDistance = distanceSquared
      rotation = -Math.atan2(dz, dx)
    }
  }
  return rotation
}
