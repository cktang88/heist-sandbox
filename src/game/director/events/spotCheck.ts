import { feetOf } from '../../security/model'
import { sendPair } from '../../security/orders'
import { floorBelow, floorName, roomOf } from '../../security/places'
import { pick, spotIn } from '../crew'
import { radio } from '../say'
import type { EventDef } from '../types'

/**
 * The control room sends a pair on a spot check of the floor the player is on (or near, if he is outside): nobody
 * suspects anything, it is routine, but two careful men walking in changes the room.
 */

export const spotCheck: EventDef = {
  id: 'spotCheck', kind: 'timed', mood: 'raise', cooldown: 90, repeats: 2, chance: 1,
  ready: (world) => world.rooms.length > 0,
  start(world, rng) {
    const here = roomOf(world, feetOf(world.player))
    const room = here ?? pick(world.rooms.filter((candidate) => candidate.kind !== 'stairwell' && candidate.storey >= 0), rng)
    if (!room) return null
    const spot = floorBelow(world, spotIn(room, rng()))
    const pair = sendPair(world, spot)
    if (pair.length === 0) return null
    radio(world, `Control: Routine check on ${floorName(world, spot)}. Have a look around.`)
    const began = world.clock
    return {
      id: 'spotCheck',
      step: (stepWorld) => stepWorld.clock - began > 40,
      outcome: () => (world.director.signals.lastSeenAt > began ? 'the check turned up the intruder' : 'the check found nothing'),
    }
  },
}
