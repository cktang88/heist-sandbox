import { flash } from './effects'
import { hearNoise } from './security/brain'
import { loudnessAt, type NoiseSource } from './security/hearing'
import { eyeOf } from './security/model'
import type { Body, Vec } from './types'
import type { World } from './world'

export const LOUD_RADIUS = 20

/**
 * Makes a sound at a spot. `radius` is how far it carries in open air, in tiles; walls, doors and floors
 * on the way muffle it. Guards who hear it react according to how loud it was when it reached them.
 * `source` is 'guard' for the guards' own gunfire and doors, which colleagues treat differently.
 */
export function emitNoise(world: World, at: Vec, radius: number, source: NoiseSource = 'player'): void {
  if (radius >= 3) flash(world.effects, at, radius, 0.5, 'noise')
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || guard.deafSeconds > 0 || guard.stunSeconds > 0 || !bodyInReach(guard, at, radius)) continue
    const ear = eyeOf(guard)
    if (Math.abs(ear.x - at.x) > radius || Math.abs(ear.y - at.y) > radius) continue
    if (loudnessAt(world, at, ear, radius) <= 0) continue
    hearNoise(world, guard, at, radius, source)
  }
}

/** A quick test on the body's box, which holds the ear, so far guards are passed over without working it out. */
function bodyInReach(body: Body, at: Vec, radius: number): boolean {
  return body.x - at.x <= radius && at.x - (body.x + body.w) <= radius && body.y - at.y <= radius && at.y - (body.y + body.h) <= radius
}
