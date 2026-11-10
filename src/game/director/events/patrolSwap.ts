import { nameOf } from '../../security/barks'
import type { Guard } from '../../security/model'
import { floorName } from '../../security/places'
import { idleGuards, pick } from '../crew'
import { radio, say } from '../say'
import type { EventDef } from '../types'

/**
 * The control room swaps two patrols' rounds to keep them fresh. Both walk across the site to their new floors, so
 * a pattern the player has learnt stops being true, and for a while two men are on the stairs.
 */

export const patrolSwap: EventDef = {
  id: 'patrolSwap', kind: 'timed', mood: 'raise', cooldown: Infinity, repeats: 1, chance: 1,
  ready: () => true,
  start(world, rng) {
    const patrols = idleGuards(world).filter((guard) => guard.role === 'patrol' && guard.route.length >= 2)
    const first = pick(patrols, rng)
    const second = first ? pick(patrols.filter((guard) => Math.abs(guard.home.y - first.home.y) > 3), rng) : null
    if (!first || !second) return null
    swapRounds(first, second)
    const [a, b] = [first, second].map((guard) => nameOf(world.guards.indexOf(guard)))
    radio(world, `Control: ${a}, take ${floorName(world, first.home)}. ${b}, you're on ${floorName(world, second.home)}. Mix it up.`)
    say(world, first, 'New round? Fine.')
    const outcome = `${a} and ${b} swapped rounds`
    return { id: 'patrolSwap', step: () => true, outcome: () => outcome }
  },
}

function swapRounds(a: Guard, b: Guard): void {
  const keep = { home: a.home, homeX: a.homeX, route: a.route, roomId: a.roomId, patrolRange: a.patrolRange }
  Object.assign(a, { home: b.home, homeX: b.homeX, route: b.route, roomId: b.roomId, patrolRange: b.patrolRange, routeIndex: 0 })
  Object.assign(b, { ...keep, routeIndex: 0 })
}
