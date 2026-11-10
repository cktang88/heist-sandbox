import { idleInput } from '../input'
import { stepWorld } from '../step'
import type { Vec } from '../types'
import { createWorld, type SiteKind, type World } from '../world'
import { startDirector } from './director'
import type { ConditionId } from './types'

/** Test support: a heist with the director on, optionally with chosen conditions instead of the seed's. */
export function directedWorld(seed: number, site: SiteKind = 'complex', picks?: ConditionId[]): World {
  const world = createWorld(seed, site)
  if (picks) world.director.picks = picks
  startDirector(world)
  return world
}

/** Out of everyone's way: in the sky over the far end of the site. */
const PARKED: Vec = { x: 2, y: 2 }

/**
 * Runs the heist with the player standing still, in coarse frames (tests care about minutes, not frames). With
 * `at` the player is held there; by default he is held in the sky where nobody sees or hears him.
 */
export function idle(world: World, seconds: number, at: Vec | null = PARKED, frame = 1 / 20): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += frame) {
    if (at) Object.assign(world.player, { x: at.x, y: at.y, vx: 0, vy: 0, hp: 100, chute: false })
    stepWorld(world, idleInput({ x: world.player.x + 5, y: world.player.y }), frame)
  }
}

/** The body position that puts the player's feet at a spot. */
export function standingAt(world: World, feet: Vec): Vec {
  return { x: feet.x - world.player.w / 2, y: feet.y - world.player.h - 0.01 }
}
