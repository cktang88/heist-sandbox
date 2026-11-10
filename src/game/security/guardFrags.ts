import { throwFrag } from '../frag/frag'
import { centerOf, distance, type Vec } from '../types'
import { normalize } from '../vision'
import type { World } from '../world'
import { barkLine } from './barks'
import { eyeOf, type Guard } from './model'

/**
 * Frag grenades thrown by guards. The frag itself (frag/frag.ts) does not say who threw it, so the security force keeps
 * its own list: when one of these goes off, colleagues hurt by it or hearing it know it was their own side's, not the
 * intruder's, and nobody runs to the blast thinking he is there.
 */

/** Same lob as the other thrown grenades, so it lands where it was aimed. */
const LOFT = 0.35
/** The frag's own blast radius (frag.ts) plus room for error: nobody of ours may be this close to where it lands. */
export const FRAG_DANGER = 4.5

/** Lobs a frag at a spot and shouts it. */
export function throwGuardFrag(world: World, guard: Guard, target: Vec): void {
  const eye = eyeOf(guard)
  const dx = target.x - eye.x
  throwFrag(world, eye, normalize(dx, target.y - eye.y - Math.abs(dx) * LOFT))
  world.security.guardFrags.push(world.frags[world.frags.length - 1])
  guard.clearedAt = world.clock
  barkLine(world, guard, 'fragOut', true)
}

/** Is a frag a guard threw going off at this spot right now? Explosions report the blast centre to whoever they hurt or reach. */
export function isGuardBlast(world: World, at: Vec): boolean {
  return world.security.guardFrags.some((frag) => frag.fuse <= 0 && distance(centerOf(frag), at) < 0.01)
}

/** Drops frags that have gone off (they went off last frame, after the guards had moved). */
export function forgetSpentFrags(world: World): void {
  const frags = world.security.guardFrags
  if (frags.length > 0 && frags.some((frag) => frag.fuse <= 0)) world.security.guardFrags = frags.filter((frag) => frag.fuse > 0)
}

/** No living, active colleague (other than the thrower) near enough to a spot to be caught by a frag there. */
export function clearOfOurMen(world: World, thrower: Guard, at: Vec): boolean {
  return world.guards.every((other) => other === thrower || other.mode === 'dead' || distance(centerOf(other), at) > FRAG_DANGER)
}
