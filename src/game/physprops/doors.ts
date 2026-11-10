import type { PropState } from '../cover'
import { propBox, propCenter } from '../hazards/props'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import { tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { blocksDoors, weightOf } from './kinds'
import { looseProps, type LooseProp } from './state'

/**
 * Heavy furniture shoved up against a closed door holds it shut. A guard who tries the door has to put his
 * shoulder to it: a few seconds of loud banging per heavy piece, after which the furniture gives and skids back.
 */

/** A prop this close to the door's face is up against it. */
const TOUCHING = 0.4
/** Door tiles are the three rows above a floor. */
const DOOR_ROWS = 3
/** A shove not kept up for this long has to start again. */
const SHOVE_FORGET = 0.5
const SHOVE_SECONDS_PER_WEIGHT = 0.8
const MIN_SHOVE_SECONDS = 2
const MAX_SHOVE_SECONDS = 6
const SHOVE_NOISE = 12
const BANG_EVERY = 0.5
/** How fast the furniture skids away from the door when it finally gives. */
const GIVE_SPEED = 7

/**
 * Is the door at this tile held shut by furniture? Each call counts as a guard leaning on it this frame, so the
 * door code calls it only while a guard is trying the door; once he has shoved long enough it gives and this
 * returns false. Untouched (static) furniture never blocks doors.
 */
export function doorBlockedAt(world: World, tile: Vec): boolean {
  if (tileAt(world.grid, tile.x, tile.y) !== 'door') return false
  const blocker = blockerOf(world, tile)
  return blocker !== null && !shove(world, blocker.prop, blocker.loose, tile)
}

function blockerOf(world: World, tile: Vec): { prop: PropState; loose: LooseProp } | null {
  for (const entry of looseProps(world)) {
    const { prop, loose } = entry
    if (!blocksDoors(prop.kind) || loose.flying || loose.vy !== 0 || world.physProps.grabbed?.id === prop.id) continue
    const box = propBox(prop)
    const floor = box.y + box.h
    if (tile.y >= floor || tile.y < floor - DOOR_ROWS) continue
    if (box.x + box.w >= tile.x - TOUCHING && box.x <= tile.x + 1 + TOUCHING) return entry
  }
  return null
}

/** One frame of a guard forcing the door. Returns true when the furniture gives way. */
function shove(world: World, prop: PropState, loose: LooseProp, tile: Vec): boolean {
  const now = world.clock
  const fresh = now - loose.shoveLast > SHOVE_FORGET
  if (fresh) loose.shoveStart = now
  const beat = (time: number) => Math.floor((time - loose.shoveStart) / BANG_EVERY)
  const at = { x: tile.x + 0.5, y: tile.y + 0.5 }
  if (fresh || beat(now) > beat(loose.shoveLast)) {
    playSound(world, 'impact', at)
    emitNoise(world, at, SHOVE_NOISE, 'guard')
  }
  loose.shoveLast = now
  if (now - loose.shoveStart < shoveSeconds(prop)) return false
  loose.vx = (propCenter(prop).x >= at.x ? 1 : -1) * GIVE_SPEED
  loose.shoveLast = -Infinity
  return true
}

export function shoveSeconds(prop: PropState): number {
  return Math.max(MIN_SHOVE_SECONDS, Math.min(MAX_SHOVE_SECONDS, weightOf(prop.kind) * SHOVE_SECONDS_PER_WEIGHT))
}
