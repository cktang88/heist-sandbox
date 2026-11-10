import { isBurningAt, nearestFire, smokeDensityAt } from '../hazards/hazards'
import type { Vec } from '../types'
import type { World } from '../world'
import { barkLine } from './barks'
import { eyeOf, feetOf, type Guard } from './model'
import { goTo } from './movement'
import { clearView, zoneOf } from './perception'
import { roomOf } from './places'
import { PATROL } from './tuning'

/**
 * Fire and smoke as the guards meet them: they get out of flames and thick smoke whatever they were doing,
 * and a guard who sees a fire goes to look and reports it once per room.
 */

const ESCAPE_DISTANCE = 4
/** Smoke this thick at head height chokes and blinds: get out. Matches where it starts to hurt (hazards/harm.ts). */
const SMOKE_ESCAPE = 0.5
/** How far either side to compare the smoke, to leave by the clearer side. */
const SMOKE_PROBE = 3
/** A guard notices flames this far off in his central cone. */
const FIRE_SIGHT = 10
/** A room's fire is reported once; after this long it may be reported again. */
const REPORT_AGAIN = 60

/** Is anything burning in the space a body fills or right beside it? Looks at a handful of tiles only. */
function fireOnBody(world: World, feet: Vec): boolean {
  for (let y = Math.floor(feet.y - 2); y <= Math.floor(feet.y - 0.5); y += 1) {
    for (let x = Math.floor(feet.x - 1.5); x <= Math.floor(feet.x + 1.5); x += 1) if (isBurningAt(world, { x, y })) return true
  }
  return false
}

/** The side with fewer burning tiles within a few steps; on a tie, the way he is already going, so he never dithers. */
function lessFire(world: World, feet: Vec, facing: 1 | -1): 1 | -1 {
  let balance = 0
  for (let step = 1; step <= ESCAPE_DISTANCE; step += 1) {
    for (const y of [feet.y - 0.5, feet.y - 1.5]) {
      if (isBurningAt(world, { x: feet.x - step, y })) balance -= 1
      if (isBurningAt(world, { x: feet.x + step, y })) balance += 1
    }
  }
  return balance === 0 ? facing : balance < 0 ? 1 : -1
}

/** Fire or thick smoke right on a guard: he shouts or coughs and gets out of it. Returns true while escaping. */
export function escapeHazard(world: World, guard: Guard, dt: number): boolean {
  const feet = feetOf(guard)
  const eye = eyeOf(guard)
  const fire = fireOnBody(world, feet)
  const smoky = !fire && smokeDensityAt(world, eye) > SMOKE_ESCAPE
  if (!fire && !smoky) return false
  barkLine(world, guard, fire ? 'fire' : 'cough')
  const away = fire ? lessFire(world, feet, guard.facing) : clearerSide(world, eye, guard)
  goTo(world, guard, { x: feet.x + away * ESCAPE_DISTANCE, y: feet.y }, PATROL.runSpeed, dt, false)
  return true
}

/**
 * Which way the smoke thins. When that is no help: away from the threat, since that is where the shooting is,
 * or else on the way he is already going (turning back each frame would leave him dithering in the cloud).
 */
function clearerSide(world: World, eye: Vec, guard: Guard): 1 | -1 {
  const left = smokeDensityAt(world, { x: eye.x - SMOKE_PROBE, y: eye.y })
  const right = smokeDensityAt(world, { x: eye.x + SMOKE_PROBE, y: eye.y })
  if (Math.abs(left - right) > 0.1) return left < right ? -1 : 1
  if (guard.lastKnown && Math.abs(eye.x - guard.lastKnown.x) > 0.5) return eye.x > guard.lastKnown.x ? 1 : -1
  return guard.facing
}

/** A fire this guard can see in front of him that nobody has reported yet, or null. */
export function spotFire(world: World, guard: Guard): Vec | null {
  if (world.hazards.fires.size === 0 || guard.blindSeconds > 0) return null
  const eye = eyeOf(guard)
  const fire = nearestFire(world, eye, FIRE_SIGHT)
  if (!fire) return null
  // Look at the near face of the burning tile: a burning wall is solid and would hide its own middle.
  const gap = Math.max(0.01, Math.hypot(eye.x - fire.x, eye.y - fire.y))
  const face = { x: fire.x + ((eye.x - fire.x) / gap) * 0.6, y: fire.y + ((eye.y - fire.y) / gap) * 0.6 }
  if (zoneOf(guard, eye, face) !== 'central' || !clearView(world, eye, face)) return null
  const room = roomOf(world, { x: fire.x, y: fire.y + 1 })?.id ?? -1
  const reportedAt = world.security.firesReported.get(room)
  return reportedAt !== undefined && world.clock - reportedAt < REPORT_AGAIN ? null : fire
}

/** Marks the fire's room as reported, so colleagues who see the same blaze do not call it in again. */
export function markFireReported(world: World, at: Vec): void {
  world.security.firesReported.set(roomOf(world, { x: at.x, y: at.y + 1 })?.id ?? -1, world.clock)
}
