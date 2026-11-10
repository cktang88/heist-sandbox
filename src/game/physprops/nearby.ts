import type { PropState } from '../cover'
import { propsNear } from '../hazards/props'
import type { Vec } from '../types'
import type { World } from '../world'
import { looseProps } from './state'

/**
 * Props around a point that are still in play: the static ones from the prop index plus every loose one
 * (which the index may still file under an older spot while it is being dragged). Burning props are left out,
 * since nobody grabs or stands on a fire.
 */
export function propsAround(world: World, at: Vec, radius: number): PropState[] {
  const found = new Map<number, PropState>()
  for (const prop of propsNear(world, at, radius)) found.set(prop.id, prop)
  for (const { prop } of looseProps(world)) found.set(prop.id, prop)
  const usable: PropState[] = []
  for (const prop of found.values()) if (!prop.broken && !world.hazards.burningProps.has(prop.id)) usable.push(prop)
  return usable
}
