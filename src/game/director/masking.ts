import { roomOf } from '../security/places'
import type { Vec } from '../types'
import type { World } from '../world'
import { isOutdoors } from './conditions/rain'

/**
 * How much of the player's own noise tonight's conditions cover at a spot, from 0 (none) to 1 (all): rain outdoors,
 * party music in and around the party room. Footstep noise multiplies its carry by `1 - footstepMasking(...)`.
 */
const PARTY_MASKING = 0.6

export function footstepMasking(world: World, feet: Vec): number {
  const masking = world.director.masking
  if (masking.rooms.size > 0) {
    const room = roomOf(world, feet)
    if (room && masking.rooms.has(room.id)) return PARTY_MASKING
  }
  return masking.outdoors > 0 && isOutdoors(world, feet) ? masking.outdoors : 0
}
