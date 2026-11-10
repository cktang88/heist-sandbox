import { floorAt } from '../../devices/floor'
import { unlockFloorDoors } from '../../devices/locks'
import { interrogate } from '../../intel/interrogate'
import { talkTerms } from '../../people/tick'
import { feetOf, type Guard } from '../../security/model'
import { roomOf } from '../../security/places'
import { distance } from '../../types'
import type { World } from '../../world'
import { say } from '../say'
import type { EventDef } from '../types'

/**
 * A guard who has given up, with the intruder standing over him, offers a deal for his life: what he knows about the
 * case if he has not talked yet, otherwise his keycard, which opens every lock on his floor.
 */

const CLOSE = 3.5

export const deal: EventDef = {
  id: 'deal', kind: 'reactive', mood: 'release', cooldown: 15, repeats: 3, chance: 0.6,
  ready: (world) => pleading(world) !== null,
  start(world) {
    const guard = pleading(world)
    if (!guard) return null
    world.director.signals.dealt.add(guard)
    // A loyal man keeps what he knows even now, and buys his life with the keycard instead.
    const talks = world.intel.places.length > 0 && !world.intel.questioned.has(guard) && !talkTerms(world, guard).refuses
    if (talks) {
      say(world, guard, 'Wait! Don\'t shoot! I know where they keep it!')
      interrogate(world, guard)
    } else {
      say(world, guard, 'Here, take my keycard! Every door on this floor. Just let me live!')
      const room = roomOf(world, feetOf(guard))
      if (room) unlockFloorDoors(world, floorAt(world, room.building, room.storey, room.floorY))
    }
    const outcome = talks ? 'he gave up what he knew about the case' : 'he handed over his keycard'
    return { id: 'deal', step: () => true, outcome: () => outcome }
  },
}

function pleading(world: World): Guard | null {
  const player = feetOf(world.player)
  return world.guards.find((guard) => guard.mode === 'surrendered' && !guard.restrained && !world.director.signals.dealt.has(guard) && distance(feetOf(guard), player) < CLOSE) ?? null
}
