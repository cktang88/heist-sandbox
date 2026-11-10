import type { PropState } from '../cover'
import { propCenter } from '../hazards/props'
import { emitNoise } from '../noise'
import { propSpec, type PropSpec } from '../propCatalog'
import { playSound } from '../sounds'
import type { World } from '../world'
import { isPushable, isTable, isThrowable, weightOf } from './kinds'
import { loosen, looseOf } from './state'

/**
 * Kicking furniture. A table goes over onto its side, away from the kicker, its top a shield that hides
 * a standing man (high cover). Anything else that can be moved skids away, lighter things further.
 */

const TIP_NOISE = 8
/** Skid speed given to a prop of weight 1 by a kick. */
const KICK_IMPULSE = 9
const MAX_SKID_SPEED = 9

/** The cover a prop gives right now: a tipped table hides a standing body, otherwise the catalogue decides. */
export function propCover(world: World, prop: PropState): PropSpec['cover'] {
  return looseOf(world, prop)?.tipped ? 'high' : propSpec(prop.kind).cover
}

/** Kicks a prop toward `side`, the way the kicker faces. Returns true if it went over or moved. */
export function kickProp(world: World, prop: PropState, side: 1 | -1): boolean {
  const loose = loosen(world, prop)
  const center = propCenter(prop)
  if (isTable(prop.kind) && !loose.tipped) {
    loose.tipped = side
    playSound(world, 'impact', center)
    emitNoise(world, center, TIP_NOISE)
    return true
  }
  if (!isPushable(prop.kind) && !isThrowable(prop.kind)) return false
  loose.vx = side * Math.min(MAX_SKID_SPEED, KICK_IMPULSE / weightOf(prop.kind))
  playSound(world, 'impact', center)
  return true
}
