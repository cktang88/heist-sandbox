import { propCenter } from '../hazards/props'
import { looseProps } from '../physprops/state'
import { distance } from '../types'
import type { World } from '../world'
import type { Finding } from './discoveries'
import { eyeOf, feetOf, type Guard } from './model'
import { hasLineOfSight } from '../vision'
import { floorBelow } from './places'

/**
 * Small oddities only a careful (veteran) guard picks up on: a desk or cabinet that has been dragged well away from
 * where it stood. He goes over to look and calls it in as something off, a lower worry than a forced lock.
 * (A dark room is handled with the power: see checkins.ts.)
 */

const MOVED_FAR = 2.5
const SIGHT = 10

/** Where each piece of furniture stood when it was first disturbed, per heist. */
const origins = new WeakMap<World, Map<number, { x: number; y: number; noticed: boolean }>>()

/** Takes note of where newly disturbed furniture stood. Cheap: only the few pieces the player has touched. */
export function rememberOrigins(world: World): void {
  let known = origins.get(world)
  if (!known) origins.set(world, (known = new Map()))
  for (const loose of world.physProps.loose.values()) {
    if (known.has(loose.id)) continue
    const prop = world.props[loose.id]
    if (prop) known.set(loose.id, { x: prop.x, y: prop.y, noticed: false })
  }
}

export function furnitureMoved(world: World, guard: Guard): Finding | null {
  const known = origins.get(world)
  if (guard.tier !== 'veteran' || !known || known.size === 0) return null
  const eye = eyeOf(guard)
  const feet = feetOf(guard)
  for (const { prop, loose } of looseProps(world)) {
    const origin = known.get(loose.id)
    if (!origin || origin.noticed || loose.flying || Math.abs(prop.y - feet.y) > 1 || Math.abs(prop.x - origin.x) < MOVED_FAR) continue
    const at = propCenter(prop)
    if (distance(eye, at) > SIGHT || (at.x - eye.x) * guard.facing < 0 || !hasLineOfSight(world.grid, eye, at)) continue
    origin.noticed = true
    const spot = floorBelow(world, at)
    return { at: spot, kind: 'tamper', priority: 2, line: 'moved', tamper: 'moved' }
  }
  return null
}
