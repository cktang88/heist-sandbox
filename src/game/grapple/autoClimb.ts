import type { Action } from '../interact'
import { CROUCH_HEIGHT, STAND_HEIGHT } from '../movement/posture'
import { MANTLE_SECONDS, type Mantle } from '../movement/ledge'
import { emitNoise } from '../noise'
import { boxHitsSolid } from '../physics'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import { TOOLS } from '../toolDefs'
import { distance, type Vec } from '../types'
import type { World } from '../world'
import { onLine } from './state'

/**
 * E with the grapple in hand: shoot the hook at the nearest ledge or floor overhead and be hauled up onto it in one
 * go. The hook bites the edge, the line reels the player up, and once he is standing there the hook comes back.
 */

/** How far above the feet a ledge can be (a storey is six rows: this reaches the floor above and a little more). */
export const ZIP_MAX_RISE = 8
/** Closer than this above the feet it is a step or an ordinary ledge grab, not a grapple. */
const ZIP_MIN_RISE = 2
/** How far to either side the hook looks for an edge. */
export const ZIP_REACH = 6
/** Rows per second the reel hauls him up, plus the time to step over the edge. */
const ZIP_SPEED = 14
const BITE_NOISE = 4

export type ZipTarget = { x: number; y: number; h: number; anchor: Vec; side: 1 | -1 }

/** True when the hook is in hand and free to shoot: the grapple equipped, not out on a line already. */
function grappleReady(world: World): boolean {
  const player = world.player
  if (TOOLS[player.tool]?.action !== 'grapple') return false
  const phase = world.grapple.phase
  return phase === 'stowed' || phase === 'retracting' || (phase === 'parked' && !onLine(world.grapple))
}

/**
 * The best place overhead to be hauled up to: a floor to stand on, between two and eight rows above the feet and
 * up to six columns to either side, with a clear way straight up from where he stands and then across onto it.
 * Nearest the cursor when it points above his head, otherwise the lowest such place, favouring the side he faces.
 */
export function findZipTarget(world: World, aim?: Vec): ZipTarget | null {
  const player = world.player
  const grid = world.grid
  const feet = player.y + player.h
  const centre = player.x + player.w / 2
  const aimAbove = aim !== undefined && aim.y < player.y
  let best: ZipTarget | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const firstColumn = Math.floor(centre - ZIP_REACH)
  const lastColumn = Math.floor(centre + ZIP_REACH)
  for (let row = Math.ceil(feet - ZIP_MAX_RISE); row <= Math.floor(feet - ZIP_MIN_RISE); row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      if (!isSolidAt(grid, column, row) || isSolidAt(grid, column, row - 1)) continue
      for (const h of [STAND_HEIGHT, CROUCH_HEIGHT]) {
        const top = row - h
        const x = column + (1 - player.w) / 2
        const stand = { x, y: top, w: player.w, h }
        if (boxHitsSolid(grid, stand)) continue
        // Straight up from where he is to the height of that floor, then across onto it.
        const rise = { x: player.x, y: top, w: player.w, h: Math.max(h, feet - top - 0.05) }
        if (boxHitsSolid(grid, rise)) continue
        const left = Math.min(player.x, x)
        const across = { x: left, y: top, w: Math.max(player.x, x) + player.w - left, h }
        if (boxHitsSolid(grid, across)) continue
        const side: 1 | -1 = Math.abs(x - player.x) < 0.05 ? player.facing : x > player.x ? 1 : -1
        // The hook bites the top of the edge nearest him.
        const anchor = { x: side > 0 ? column + 0.1 : column + 0.9, y: row + 0.05 }
        const facingAway = (x + player.w / 2 - centre) * player.facing < -0.5
        const score = aimAbove
          ? distance(aim!, { x: x + player.w / 2, y: row })
          : (feet - row) * 2 + Math.abs(x - player.x) * 0.5 + (facingAway ? 3 : 0) + (h < STAND_HEIGHT ? 1 : 0)
        if (score < bestScore) {
          best = { x, y: top, h, anchor, side }
          bestScore = score
        }
        break
      }
    }
  }
  return best
}

/** The E action, offered when nothing closer at hand wants the key. */
export function zipAction(world: World, aim?: Vec): Action | null {
  const player = world.player
  if (!grappleReady(world) || player.mantle || player.hidden || player.stairs || world.stealth.carried !== null) return null
  if (!player.onGround && !player.onLadder) return null
  const target = findZipTarget(world, aim)
  if (!target) return null
  return {
    prompt: 'E: grapple up', key: `zip:${Math.round(target.x)}:${Math.round(target.y)}`, at: target.anchor,
    run: () => startZip(world, target),
  }
}

/** Fires the hook into the edge and starts the haul up, as one long climb over the ledge. */
export function startZip(world: World, target: ZipTarget): void {
  const player = world.player
  const grapple = world.grapple
  const feet = player.y + player.h
  player.h = target.h
  player.y = feet - target.h
  player.crouching = target.h < STAND_HEIGHT
  player.onLadder = false
  player.chute = false
  player.slide = 0
  player.vx = 0
  player.vy = 0
  const rise = feet - (target.y + target.h)
  const across = Math.abs(target.x - player.x)
  const mantle: Mantle = {
    from: { x: player.x, y: player.y }, to: { x: target.x, y: target.y }, t: 0,
    duration: Math.max(MANTLE_SECONDS, (rise + across) / ZIP_SPEED + MANTLE_SECONDS * 0.6), side: target.side, stepAfterRise: true,
  }
  player.mantle = mantle
  Object.assign(grapple, {
    phase: 'attached', hook: { ...target.anchor }, anchor: { x: Math.floor(target.anchor.x), y: Math.floor(target.anchor.y) }, bend: null,
    hanging: false, reeling: 1, fling: 0, vaultToLine: false, zip: true,
  })
  grapple.length = rise
  playSound(world, 'impact', target.anchor)
  emitNoise(world, target.anchor, BITE_NOISE)
}
