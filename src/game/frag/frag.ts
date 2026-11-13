import { explode, type Blast } from '../explosions'
import { boxHitsSolid, GRAVITY, moveBody } from '../physics'
import { climbStairs, findLanding, landingX, type OnStairs } from '../stairs'
import { centerOf, type Body, type Vec } from '../types'
import type { World } from '../world'

/**
 * A thrown fragmentation grenade. It flies and bounces like the smoke and flash grenades, and a frag that rolls onto
 * a landing heading for the flight below rattles down the staircase, landing after landing, until its fuse runs out.
 */
export type Frag = Body & { fuse: number; stairs: OnStairs | null }

/** The same throw as the other grenades (hazards/grenades.ts), so all of them land where the player expects. */
const THROW_SPEED = 15
const LOFT = 3
const SIZE = 0.3
const BOUNCE = 0.35
const ROLL_FRICTION = 4
/** A body this close above the floor, and coming down slower than this (tiles a second), is lying on it. */
const RESTING = 0.01
const SETTLED = 1
const FUSE_SECONDS = 2.5
/** Rolling slower than this, it stops at the landing instead of taking the stairs. */
const ROLL_ONTO_STAIRS = 0.5
/** Thrown at least this steeply downward from the stairs, it goes down them. */
const DOWN_THE_STAIRS = 0.3
/** Shrapnel, not a demolition charge: it shreds people, glass, wood and stair flights but not concrete walls. */
export const FRAG_BLAST: Blast = { radius: 3.2, tileDamage: 90, bodyDamage: 170 }

export function throwFrag(world: World, from: Vec, direction: Vec): void {
  const length = Math.hypot(direction.x, direction.y) || 1
  const frag: Frag = {
    x: from.x - SIZE / 2, y: from.y - SIZE / 2, w: SIZE, h: SIZE,
    vx: (direction.x / length) * THROW_SPEED, vy: (direction.y / length) * THROW_SPEED - LOFT, onGround: false,
    fuse: FUSE_SECONDS, stairs: null,
  }
  // Lobbed downward by someone on a staircase, it goes straight down the flight under their feet.
  const on = world.player.stairs
  if (on && direction.y / length > DOWN_THE_STAIRS) frag.stairs = { well: on.well, u: on.u }
  world.frags.push(frag)
}

export function stepFrags(world: World, dt: number): void {
  if (world.frags.length === 0) return
  for (const frag of world.frags) {
    if (frag.stairs) rattleDown(world, frag, dt)
    else {
      fly(world, frag, dt)
      takeStairs(world, frag)
    }
    frag.fuse -= dt
  }
  const due = world.frags.filter((frag) => frag.fuse <= 0)
  world.frags = world.frags.filter((frag) => frag.fuse > 0)
  // The security force keeps the list of frags its own men threw (security/guardFrags.ts).
  for (const frag of due) explode(world, centerOf(frag), FRAG_BLAST, world.security.guardFrags.includes(frag) ? 'guard' : 'player')
}

/** Flies, bounces a little off whatever it hits, and rolls to rest. */
function fly(world: World, frag: Frag, dt: number): void {
  // Lying on the floor and not bouncing off it. Asked of the floor, not of `onGround`: on fast frames gravity does
  // not always carry it the hair down to the floor in one frame, so that flag flickers while it rolls.
  const rolling = Math.abs(frag.vy) < SETTLED && boxHitsSolid(world.grid, { ...frag, y: frag.y + RESTING })
  frag.vy += GRAVITY * dt
  const before = { x: frag.vx, y: frag.vy }
  if (moveBody(world.grid, frag, dt, 0)) frag.vx = -before.x * BOUNCE
  if (frag.vy === 0 && before.y !== 0) {
    frag.vy = Math.abs(before.y) > 4 ? -before.y * BOUNCE : 0
    if (frag.onGround && !rolling) frag.vx *= 0.75
  }
  // Rolling, it scrapes the floor all the time, not once per frame: the same speed is lost each second at any frame rate.
  if (rolling) frag.vx *= Math.pow(0.75, dt * 60)
  if (rolling || (frag.onGround && frag.vy === 0)) {
    frag.vx *= Math.max(0, 1 - ROLL_FRICTION * dt)
    if (Math.abs(frag.vx) < 0.05) frag.vx = 0
  }
}

/** Rolling across a landing toward the flight below, it drops onto the stairs. */
function takeStairs(world: World, frag: Frag): void {
  if (!frag.onGround || Math.abs(frag.vx) < ROLL_ONTO_STAIRS) return
  const landing = findLanding(world.stairwells, frag.x + frag.w / 2, frag.y + frag.h)
  if (!landing || landing.stop === 0) return
  const downward = landingX(landing.well, landing.stop - 1) - landingX(landing.well, landing.stop)
  if (Math.sign(downward) !== Math.sign(frag.vx)) return
  frag.stairs = { well: landing.well.id, u: landing.stop }
}

/** Down the staircase, through every landing, until it reaches the bottom or the flight it is on is blown away. */
function rattleDown(world: World, frag: Frag, dt: number): void {
  const on = frag.stairs!
  const well = world.stairwells.find((candidate) => candidate.id === on.well)
  // A blown flight leaves the lower piece with the old id and fewer stops (stairs.ts `breakFlight`): past its top,
  // the frag was on the flight that went, or above it, and it drops from where it is.
  if (!well || on.u <= 0 || on.u > well.stops.length - 1) {
    frag.stairs = null
    return
  }
  climbStairs(frag, on, well, -1, true, dt)
  frag.onGround = true
  if (on.u <= 0) frag.stairs = null
}
