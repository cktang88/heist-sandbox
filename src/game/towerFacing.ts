import type { MapDefinition, Placement, Point, TowerStats } from './types'

const FULL_TURN = Math.PI * 2

export function normalizeAngle(angle: number): number {
  return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN
}

/** World-space direction in radians: 0 points east (+x), PI/2 points south (+z). */
export function aimRotation(origin: Point, target: Point, fallback = 0): number {
  const dx = target.x - origin.x
  const dz = target.z - origin.z
  return Math.hypot(dx, dz) < 0.001 ? normalizeAngle(fallback) : normalizeAngle(Math.atan2(dz, dx))
}

export type TowerAimStep =
  | { status: 'aiming'; origin: Point }
  | { status: 'committed'; origin: Point; rotation: number }

/** First click anchors the base; second click commits its direction. */
export function advanceTowerAim(origin: Point | null, click: Point, fallback = 0): TowerAimStep {
  return origin
    ? { status: 'committed', origin, rotation: aimRotation(origin, click, fallback) }
    : { status: 'aiming', origin: { ...click } }
}

export function angleDifference(a: number, b: number): number {
  const difference = normalizeAngle(a) - normalizeAngle(b)
  return Math.atan2(Math.sin(difference), Math.cos(difference))
}

export function isPointWithinTowerArc(tower: Pick<Placement, 'x' | 'z' | 'rotation'>, point: Point, arcDegrees = 360): boolean {
  if (arcDegrees >= 360 || tower.rotation === undefined) return true
  const targetAngle = Math.atan2(point.z - tower.z, point.x - tower.x)
  return Math.abs(angleDifference(targetAngle, tower.rotation)) <= arcDegrees * Math.PI / 360 + 1e-9
}

export function getTowerArcDegrees(stats: TowerStats): number {
  return Math.min(360, Math.max(1, stats.firingArcDegrees ?? 360))
}

/** Support towers display their aura; weapons display their targeting distance. */
export function getTowerDisplayedRange(stats: TowerStats): number {
  return stats.attack.kind === 'support' ? stats.attack.radius : stats.range
}

/** Old layouts had no facing. Aim them toward the nearest authored fortress endpoint. */
export function defaultTowerRotation(map: MapDefinition, tower: Point): number {
  let closest: Point | undefined
  let closestDistance = Number.POSITIVE_INFINITY
  for (const path of map.paths) {
    const fortress = path[path.length - 1]
    if (!fortress) continue
    const distance = Math.hypot(fortress.x - tower.x, fortress.z - tower.z)
    if (distance < closestDistance) {
      closest = fortress
      closestDistance = distance
    }
  }
  return closest ? aimRotation(tower, closest) : 0
}
