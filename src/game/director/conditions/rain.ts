import type { Rng } from '../../rng'
import { feetOf, isActive, type Guard } from '../../security/model'
import { distance, type Vec } from '../../types'
import type { World } from '../../world'
import { say } from '../say'
import type { ActiveCondition, ConditionDef } from '../types'

/**
 * Heavy rain. The downpour drowns out footsteps outside (the masking is read by the footstep noise, see `masking.ts`),
 * and guards walking open ground cut their rounds short to stay near shelter, which leaves the far ends unwatched.
 */

/** Share of a footstep's carry the rain takes away outdoors. */
export const RAIN_MASKING = 0.5
/** Outdoor patrols walk this share of their usual round. */
const HUDDLE_SHARE = 0.35
const GRUMBLE_SECONDS = 45
const GRUMBLE_RANGE = 18
const GRUMBLES = ['Lovely night for it.', 'Soaked to the bone...', 'Who schedules a watch in this?', 'Can\'t hear a thing in this rain.']

export const rain: ConditionDef = {
  id: 'rain',
  fits: () => true,
  excludes: ['storm'],
  start: (world, rng) => startRain(world, rng, 'Heavy rain: the downpour drowns out footsteps outside, and guards in the open keep close to shelter.'),
}

export function startRain(world: World, rng: Rng, line: string): ActiveCondition {
  world.director.masking.outdoors = RAIN_MASKING
  for (const guard of world.guards) if (isOutdoors(world, feetOf(guard))) huddle(guard)
  let grumble = GRUMBLE_SECONDS * (0.5 + rng())
  return {
    id: 'rain',
    line,
    step(stepWorld, dt) {
      grumble -= dt
      if (grumble > 0) return
      grumble = GRUMBLE_SECONDS * (0.7 + rng())
      const near = stepWorld.guards.find((guard) => isActive(guard) && guard.mode === 'calm' && isOutdoors(stepWorld, feetOf(guard)) && distance(feetOf(guard), stepWorld.player) < GRUMBLE_RANGE)
      if (near) say(stepWorld, near, GRUMBLES[Math.floor(rng() * GRUMBLES.length)])
    },
  }
}

/** Out in the weather: not inside any room of any building. */
export function isOutdoors(world: World, feet: Vec): boolean {
  const y = feet.y - 1
  if (y > world.groundY) return false
  return !world.interiors.some((area) => area.kind === 'room' && feet.x >= area.x && feet.x < area.x + area.w && y >= area.y && y < area.y + area.h)
}

function huddle(guard: Guard): void {
  if (guard.role !== 'patrol' || guard.route.length < 2) return
  const centre = guard.home.x
  guard.route = guard.route.map((point) => ({ x: centre + (point.x - centre) * HUDDLE_SHARE, y: point.y }))
  guard.patrolRange *= HUDDLE_SHARE
}
