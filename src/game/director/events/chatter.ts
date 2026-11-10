import { feetOf, type Guard } from '../../security/model'
import { roomOf } from '../../security/places'
import type { Vec } from '../../types'
import type { World } from '../../world'
import { idleGuards, nearestTo, spotIn } from '../crew'
import { startErrand, stepErrand, type ErrandPlan } from '../errand'
import { say } from '../say'
import type { EventDef } from '../types'
import { unseenFor } from '../watch'

/**
 * Two guards meet for a chat in a room near the player's. Calm guards talking are what the intel module listens for,
 * so getting close unseen may pick up where the case is.
 */

const QUIET_FOR = 70
const NEAR = { min: 6, max: 26 }
const OPENERS = ['Got a light?', 'You hear the boss is in a mood tonight?', 'Two more hours of this...', 'Hey. Got a minute?']
const PLAN: ErrandPlan = { linger: 28, limit: 60 }

export const chatter: EventDef = {
  id: 'chatter', kind: 'reactive', mood: 'release', cooldown: 150, repeats: 2, chance: 0.4,
  ready: (world) => world.security.level <= 1 && unseenFor(world) > QUIET_FOR && roomOf(world, feetOf(world.player)) !== undefined,
  start(world, rng) {
    const meeting = meetingSpot(world, rng)
    if (!meeting) return null
    const pair = twoNearest(world, meeting)
    if (!pair) return null
    const errands = pair.map((guard, index) => startErrand(world, guard, { x: meeting.x + (index === 0 ? -0.8 : 0.8), y: meeting.y }))
    say(world, pair[0], OPENERS[Math.floor(rng() * OPENERS.length)])
    return {
      id: 'chatter',
      step: (stepWorld, dt) => errands.map((errand) => stepErrand(stepWorld, errand, PLAN, dt)).every(Boolean),
      outcome: () => (overheard(world, pair) ? 'two guards stopped to chat, and the player listened in' : 'two guards stopped to chat'),
    }
  },
}

/** The intel module marks a pair it has been overheard by under either order of their numbers. */
function overheard(world: World, pair: Guard[]): boolean {
  const [a, b] = pair.map((guard) => world.guards.indexOf(guard))
  return world.intel.used.has(`chatter:${a}-${b}`) || world.intel.used.has(`chatter:${b}-${a}`)
}

/** A room on the player's floor, near but not on top of him. */
function meetingSpot(world: World, rng: () => number): Vec | null {
  const feet = feetOf(world.player)
  const here = roomOf(world, feet)
  if (!here) return null
  const rooms = world.rooms.filter((room) => room.building === here.building && room.storey === here.storey && room.kind !== 'stairwell')
    .map((room) => ({ room, spot: spotIn(room, 0.3 + rng() * 0.4) }))
    .filter(({ spot }) => Math.abs(spot.x - feet.x) >= NEAR.min && Math.abs(spot.x - feet.x) <= NEAR.max)
  return rooms.length === 0 ? null : rooms[Math.floor(rng() * rooms.length)].spot
}

function twoNearest(world: World, at: Vec): [Guard, Guard] | null {
  const free = idleGuards(world).filter((guard) => guard.role === 'patrol')
  const first = nearestTo(free, at, feetOf)
  const second = first ? nearestTo(free.filter((guard) => guard !== first), at, feetOf) : null
  return first && second ? [first, second] : null
}
