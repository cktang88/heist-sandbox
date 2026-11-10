import { burst } from '../effects'
import { propBroke } from '../hazards/hazards'
import { propById, propCenter } from '../hazards/props'
import { playSound } from '../sounds'
import type { Vec } from '../types'
import type { World } from '../world'
import { burstPipe } from './pipes'
import type { Target } from './targets'

/**
 * A bullet went through one of the things only this system cares about. A ceiling pipe runs along the top of the
 * room, up against the slab: only a round fired up into the ceiling strikes it, not one passing down a hole past it.
 */
export function hitTarget(world: World, target: Target, at: Vec, heading: Vec): void {
  if (target.kind === 'pipe') {
    if (target.prop >= 0 || heading.y < 0) burstPipe(world, at, target.box)
    return
  }
  const prop = target.prop >= 0 ? propById(world, target.prop) : undefined
  if (target.kind === 'fixture' && prop && !prop.broken) {
    prop.hp = 0
    propBroke(world, prop)
    playSound(world, 'impact', at)
    burst(world.effects, world.systems.rng, propCenter(prop), 8, '#e8e6df', 6)
  }
}
