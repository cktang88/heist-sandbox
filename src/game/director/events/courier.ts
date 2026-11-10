import { feetOf } from '../../security/model'
import { centerOf } from '../../types'
import { idleGuards, nearestTo } from '../crew'
import { startErrand, stepErrand, type ErrandPlan } from '../errand'
import { radio, say } from '../say'
import type { EventDef } from '../types'

/**
 * When the guards decide to move the case (the intel module's own plan, once the alarm has rung), a courier is sent
 * running to the new place, so the move can be seen and followed, not just read about in stale clues.
 */

const PLACE_WORDS = { vault: 'vault', safe: 'executive safe', lab: 'lab', storage: 'store room', armory: 'armoury' } as const
const PLAN: ErrandPlan = { arriveLine: 'Package is secure.', linger: 10, limit: 90 }

export const courier: EventDef = {
  id: 'courier', kind: 'reactive', mood: 'raise', cooldown: 30, repeats: 2, chance: 1,
  ready: (world) => world.intel.move.ordered && world.intel.move.to !== null && !world.loot.taken,
  start(world) {
    const target = world.intel.places[world.intel.move.to ?? -1]
    if (!target) return null
    const courierGuard = nearestTo(idleGuards(world), centerOf(world.loot), feetOf)
    if (!courierGuard) return null
    const movesBefore = world.intel.move.moves
    const where = PLACE_WORDS[target.kind]
    radio(world, `Control: Courier, take the package to the ${where}. Move!`)
    say(world, courierGuard, 'On it. Moving the package.')
    const errand = startErrand(world, courierGuard, { x: target.x + target.w / 2, y: target.floorY })
    return {
      id: 'courier',
      step: (stepWorld, dt) => stepErrand(stepWorld, errand, PLAN, dt) || stepWorld.loot.taken,
      outcome: () => (world.intel.move.moves > movesBefore ? `the case was moved to the ${where}` : `a courier ran for the ${where}, but the case stayed put`),
    }
  },
}
