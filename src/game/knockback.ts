import { isNavigationPositionWalkable, type NavigationField } from './navigation'
import type { Point } from './types'

export type KnockbackBody = Point & { id?: number; knockbackX?: number; knockbackZ?: number }

const MAX_SUBSTEP = 0.16
const DRAG_PER_SECOND = 5.5

export function addKnockback(body: KnockbackBody, origin: Point, force: number, resistance = 1): void {
  const dx = body.x - origin.x
  const dz = body.z - origin.z
  const length = Math.hypot(dx, dz)
  if (force <= 0) return
  const amount = force * Math.max(0, resistance)
  const angle = (body.id ?? 1) * 2.399963229728653
  const directionX = length < 0.0001 ? Math.cos(angle) : dx / length
  const directionZ = length < 0.0001 ? Math.sin(angle) : dz / length
  body.knockbackX = (body.knockbackX ?? 0) + directionX * amount
  body.knockbackZ = (body.knockbackZ ?? 0) + directionZ * amount
}

/** Moves an impulse in small grid-tested steps, stopping or sliding instead of tunnelling through walls. */
export function stepKnockback(body: KnockbackBody, field: NavigationField, delta: number): void {
  let velocityX = body.knockbackX ?? 0
  let velocityZ = body.knockbackZ ?? 0
  const distance = Math.hypot(velocityX, velocityZ) * delta
  if (distance < 0.0001) {
    body.knockbackX = 0
    body.knockbackZ = 0
    return
  }
  const steps = Math.max(1, Math.ceil(distance / MAX_SUBSTEP))
  const stepX = velocityX * delta / steps
  const stepZ = velocityZ * delta / steps
  for (let index = 0; index < steps; index += 1) {
    const nextX = body.x + stepX
    const nextZ = body.z + stepZ
    if (isNavigationPositionWalkable(field, nextX, nextZ)) {
      body.x = nextX
      body.z = nextZ
      continue
    }
    if (isNavigationPositionWalkable(field, nextX, body.z)) body.x = nextX
    else velocityX = 0
    // Test Z from the possibly updated X position so two valid axis moves cannot
    // combine into a blocked diagonal corner.
    if (isNavigationPositionWalkable(field, body.x, nextZ)) body.z = nextZ
    else velocityZ = 0
    if (velocityX === 0 && velocityZ === 0) break
  }
  const drag = Math.max(0, 1 - DRAG_PER_SECOND * delta)
  body.knockbackX = Math.abs(velocityX * drag) < 0.01 ? 0 : velocityX * drag
  body.knockbackZ = Math.abs(velocityZ * drag) < 0.01 ? 0 : velocityZ * drag
}

export function knockbackResistance(kind: string): number {
  return kind === 'ogre' ? 0.22 : kind === 'brute' || kind === 'armored' ? 0.55 : kind === 'shieldbearer' ? 0.7 : 1
}
