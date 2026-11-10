import { blastCables } from '../elevators'
import type { Flash } from '../effects'
import { cutRopesNear } from '../rope/rope'
import { blastStairs } from '../stairs'
import type { World } from '../world'

/**
 * What an explosion does to the building's moving parts: stair flights, elevator cables and climbing ropes.
 * Every explosion leaves an 'explosion' flash sized to its blast (explosions.ts), so watching for new ones catches
 * rockets, C4, frags, barrels and vehicles alike without touching the explosion code.
 */
const seen = new WeakSet<Flash>()

export function stepAftermath(world: World): void {
  for (const blast of world.effects.flashes) {
    if (blast.kind !== 'explosion' || seen.has(blast)) continue
    seen.add(blast)
    blastStairs(world, blast, blast.radius)
    blastCables(world, blast, blast.radius)
    cutRopesNear(world, blast, blast.radius)
  }
}
