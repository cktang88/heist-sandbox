import { feetOf } from '../../security/model'
import { nearestFree, startSearch } from '../../security/orders'
import { floorBelow, floorName } from '../../security/places'
import type { World } from '../../world'
import { radio } from '../say'
import type { EventDef } from '../types'

/**
 * Once the first body is reported, the control room orders a sweep of that floor: four more guards search it room by
 * room. Whether they find the intruder is up to him.
 */

const SWEEPERS = 4
const SWEEP_SECONDS = 50

export const sweep: EventDef = {
  id: 'sweep', kind: 'reactive', mood: 'raise', cooldown: Infinity, repeats: 1, chance: 1,
  ready: (world) => world.security.reportedBodies.size > 0,
  start(world) {
    const body = world.guards[[...world.security.reportedBodies][0]]
    if (!body) return null
    const centre = floorBelow(world, feetOf(body))
    const sweepers = nearestFree(world, centre, SWEEPERS)
    if (sweepers.length === 0) return null
    for (const guard of sweepers) startSearch(world, guard, centre, SWEEP_SECONDS)
    radio(world, `Control: Sweep ${floorName(world, centre)}, room by room. Nobody leaves.`)
    const began = world.clock
    return {
      id: 'sweep',
      step: (stepWorld: World) => stepWorld.clock - began > SWEEP_SECONDS,
      outcome: () => (world.director.signals.lastSeenAt > began ? 'the sweep flushed the intruder out' : 'the sweep came up empty'),
    }
  },
}
