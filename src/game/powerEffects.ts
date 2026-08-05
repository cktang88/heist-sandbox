import type { ActivePowerKind, EnemyKind, Point } from './types'
import { knockbackResistance } from './knockback'

type KnockbackTarget = Point & { id: number; kind: EnemyKind }

/** Nuke damage stays lethal near the marker but falls to 25% at its edge. */
export function powerDamageAt(kind: ActivePowerKind, damage: number, target: Point, center: Point, radius: number): number {
  if (kind !== 'nuke') return damage
  return damage * radialFalloff(target, center, radius, 0.25)
}

/** Returns an impulse rather than mutating an enemy, which keeps this easy to tune and test. */
export function powerKnockback(kind: ActivePowerKind, target: KnockbackTarget, center: Point, radius: number, lineEnd?: Point): Point {
  const resistance = knockbackResistance(target.kind)
  if (kind === 'strafe') {
    if (lineEnd) {
      const dx = lineEnd.x - center.x
      const dz = lineEnd.z - center.z
      const length = Math.hypot(dx, dz)
      if (length > 0.001) {
        const cross = dx * (target.z - center.z) - dz * (target.x - center.x)
        const side = cross === 0 ? (target.id % 2 === 0 ? 1 : -1) : Math.sign(cross)
        return { x: (-dz / length) * side * 0.16 * resistance, z: (dx / length) * side * 0.16 * resistance }
      }
    }
    const side = target.z === center.z ? (target.id % 2 === 0 ? 1 : -1) : Math.sign(target.z - center.z)
    return { x: 0, z: side * 0.16 * resistance }
  }
  if (kind !== 'nuke') return { x: 0, z: 0 }

  const dx = target.x - center.x
  const dz = target.z - center.z
  const length = Math.hypot(dx, dz)
  const direction = length > 0.001
    ? { x: dx / length, z: dz / length }
    : deterministicDirection(target.id)
  const force = 1.35 * radialFalloff(target, center, radius, 0.15) * resistance
  return { x: direction.x * force, z: direction.z * force }
}

export function duePowerImpacts(elapsed: number, duration: number, impactCount: number): number {
  if (duration <= 0) return impactCount
  return Math.min(impactCount, Math.ceil((Math.max(0, elapsed) / duration) * impactCount))
}

function radialFalloff(target: Point, center: Point, radius: number, edgeMultiplier: number): number {
  if (radius <= 0) return 1
  const amount = Math.min(1, Math.hypot(target.x - center.x, target.z - center.z) / radius)
  return 1 - amount * (1 - edgeMultiplier)
}

function deterministicDirection(id: number): Point {
  const angle = id * 2.399963229728653
  return { x: Math.cos(angle), z: Math.sin(angle) }
}
