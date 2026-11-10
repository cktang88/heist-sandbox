import type { Input } from '../input'
import type { World } from '../world'
import { guardWantsToDrop } from './intent'
import { anyWalkPast } from './holes'
import { currentHoles } from './state'
import { carryAcross, rememberFooting } from './walk'

export { canWalkAcross, carryAcross } from './walk'
export { wantsToDrop, guardWantsToDrop } from './intent'
export { depthOffsetFor, nearestHole } from './depth'
export { createGaps, type GapState } from './state'

/**
 * Floor holes as a choice: walk past (the default), drop through (hold down), or climb up through (the ledge grab).
 * Runs after the player and the guards have moved. With nothing to walk past on the site it costs two number compares.
 */
export function stepGaps(world: World, input: Input): void {
  const holes = currentHoles(world)
  if (!anyWalkPast(holes)) {
    if (world.gaps.stoodAt.size > 0) world.gaps.stoodAt.clear()
    return
  }
  const player = world.player
  if (!player.stairs && !player.mantle && !player.onLadder) {
    const drop = !world.drone && input.down
    if (carryAcross(world, player, drop)) {
      player.chute = false
      player.airJumps = 1
    }
    rememberFooting(world, player)
  }
  for (const guard of world.guards) {
    if (guard.state === 'dead' || guard.ragdoll || guard.stairs || guard.climbing) continue
    carryAcross(world, guard, guardWantsToDrop(guard, Math.floor(guard.y + guard.h)))
    rememberFooting(world, guard)
  }
}
