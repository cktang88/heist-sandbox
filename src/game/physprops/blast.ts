import type { PropState } from '../cover'
import { propCenter } from '../hazards/props'
import type { Vec } from '../types'
import type { World } from '../world'
import { isPushable, isThrowable, weightOf } from './kinds'
import { propsAround } from './nearby'
import { loosen } from './state'

/**
 * A blast knocks loose furniture about: what a person could move and the blast did not destroy is thrown outward, faster the closer and lighter it
 * is, and the throw code (melee/throw.ts) flies it from there, through glass and into people, until it drops and
 * gravity (gravity.ts) lands it, through a hole if there is one. Heavy things only shift along the floor. Bolted
 * fixtures stay where they are. Only the nearest few are thrown, so a blast in a full room stays cheap.
 */
export const MAX_THROWN_PER_BLAST = 8
const THROW_SPEED = 20
const MAX_SPEED = 22
/** Heavier than this it does not leave the floor; it slides a little instead. */
const HEAVY = 3.5
const SHIFT_SPEED = 3
/** Thrown things go up and out, not along the floor: this share of the speed again, upward. */
const LIFT = 0.6
/** The blast wave shoves things twice as far out as it destroys them, falling off to nothing at the edge. */
const REACH_SHARE = 2
const EDGE = 0.6

export function throwPropsFromBlast(world: World, at: Vec, blastRadius: number): void {
  const radius = blastRadius * REACH_SHARE
  const candidates: Array<{ prop: PropState; gap: number }> = []
  for (const prop of propsAround(world, at, radius)) {
    if (!(isPushable(prop.kind) || isThrowable(prop.kind)) || world.physProps.grabbed?.id === prop.id) continue
    const gap = Math.hypot(propCenter(prop).x - at.x, propCenter(prop).y - at.y)
    if (gap <= radius) candidates.push({ prop, gap })
  }
  candidates.sort((a, b) => a.gap - b.gap || a.prop.id - b.prop.id)
  for (const { prop, gap } of candidates.slice(0, MAX_THROWN_PER_BLAST)) knockLoose(world, prop, at, gap, radius)
}

function knockLoose(world: World, prop: PropState, at: Vec, gap: number, radius: number): void {
  const force = Math.max(0, 1 - gap / (radius + EDGE))
  const center = propCenter(prop)
  const away = Math.max(0.2, gap)
  // Straight above or below the blast it still goes somewhere: off to the side it stands on.
  const dx = Math.abs(center.x - at.x) < 0.05 ? (prop.id % 2 === 0 ? 0.3 : -0.3) : (center.x - at.x) / away
  const dy = (center.y - at.y) / away
  const weight = weightOf(prop.kind)
  const loose = loosen(world, prop)
  if (weight > HEAVY) {
    loose.vx += Math.sign(dx) * SHIFT_SPEED * force * (HEAVY / weight)
    return
  }
  const speed = Math.min(MAX_SPEED, (THROW_SPEED * force) / Math.sqrt(Math.max(0.5, weight)))
  Object.assign(loose, { flying: true, tipped: 0, vx: dx * speed, vy: Math.min(dy * speed, 0) - LIFT * speed })
}
