import { onLine } from '../grapple/state'
import type { Input } from '../input'
import type { World } from '../world'
import { guardDropsThrough } from '../security/holeDrop'
import { anyWalkPast } from './holes'
import { currentHoles } from './state'
import { carryAcross, rememberFooting } from './walk'

export { backStripAt, canWalkAcross, carryAcross } from './walk'
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
  // Hanging on a line or a ladder counts as footing at that height: let go above a holed floor and you step
  // onto what is left of it; let go below it and you fall.
  if (onLine(world.grapple) || player.onLadder) world.gaps.stoodAt.set(player, player.y + player.h)
  else if (!player.stairs && !player.mantle) {
    const drop = !world.drone && input.down
    if (carryAcross(world, player, drop)) {
      player.chute = false
      player.airJumps = 1
      // He has landed: a swing still being carried from a jump off the grapple line ends here.
      world.grapple.fling = 0
    }
    rememberFooting(world, player)
  }
  for (const guard of world.guards) {
    if (guard.state === 'dead' || guard.ragdoll || guard.stairs || guard.climbing) continue
    carryAcross(world, guard, guardDropsThrough(world, guard, Math.floor(guard.y + guard.h)))
    rememberFooting(world, guard)
  }
}
