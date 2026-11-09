import { flash } from './effects'
import { investigate } from './guards'
import { centerOf, distance, type Vec } from './types'
import type { World } from './world'

export const LOUD_RADIUS = 20

/** Makes a sound at a spot. Guards in earshot who are not already fighting go and look. */
export function emitNoise(world: World, at: Vec, radius: number): void {
  if (radius >= 3) flash(world.effects, at, radius, 0.5, 'noise')
  for (const guard of world.guards) {
    if (guard.state === 'dead' || guard.state === 'alert') continue
    if (distance(centerOf(guard), at) > radius) continue
    investigate(guard, at)
    if (radius >= LOUD_RADIUS) guard.awareness = Math.max(guard.awareness, 0.5)
  }
}
