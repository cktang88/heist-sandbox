import { feetOf } from '../../security/model'
import { roomOf } from '../../security/places'
import { idleGuards, pick, spotIn } from '../crew'
import { startErrand, stepErrand, type ErrandPlan } from '../errand'
import { say } from '../say'
import type { EventDef } from '../types'
import { unseenFor } from '../watch'

/**
 * When the player has gone unseen for a long while, a bored guard wanders off his round to another floor: a gap where
 * he should be, and a man where nobody should be.
 */

const BORED_AFTER = 100
const PLAN: ErrandPlan = { arriveLine: 'Nobody comes up here anyway.', leaveLine: 'Better get back before anyone notices.', linger: 35, limit: 80 }

export const wanderer: EventDef = {
  id: 'wanderer', kind: 'reactive', mood: 'release', cooldown: 120, repeats: 2, chance: 0.35,
  ready: (world) => world.security.level <= 1 && unseenFor(world) > BORED_AFTER,
  start(world, rng) {
    const guard = pick(idleGuards(world).filter((candidate) => candidate.role === 'patrol'), rng)
    if (!guard) return null
    const building = roomOf(world, feetOf(guard))?.building
    const elsewhere = world.rooms.filter((room) => room.building === building && room.kind !== 'stairwell' && room.floorY !== guard.home.y && Math.abs(room.floorY - guard.home.y) <= 18)
    const room = pick(elsewhere, rng)
    if (!room) return null
    say(world, guard, 'Stretching my legs.')
    const errand = startErrand(world, guard, spotIn(room, rng()))
    return {
      id: 'wanderer',
      step: (stepWorld, dt) => stepErrand(stepWorld, errand, PLAN, dt),
      outcome: () => errand.state === 'done' ? 'he wandered off his round and back again' : 'his stroll was cut short',
    }
  },
}
