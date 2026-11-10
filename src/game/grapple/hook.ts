import { burst } from '../effects'
import { isBurningAt } from '../hazards/hazards'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import { TILE_DEFS, tileAt, type TileKind } from '../tiles'
import { distance, type Vec } from '../types'
import { castRay } from '../vision'
import type { World } from '../world'
import { gripOf } from './line'
import type { GrappleState } from './state'

/** The hook flies straight (no drop): fast enough that gravity would barely bend it over this range. */
export const HOOK_SPEED = 70
export const HOOK_RANGE = 28
const RETRACT_SPEED = 90
/** A quiet tool, but the bite is a clack a guard in the next room can hear. */
const BITE_NOISE = 4
/** The hook rests this far out of the face it bit, so the line point is never inside the tile. */
const BITE_STANDOFF = 0.08
const LINE_FIBRE = '#2c2f33'

/** Glass shatters under it and a door swings, so neither can hold a hook; open air and ladders are not hit at all. */
export function holdsHook(kind: TileKind): boolean {
  return TILE_DEFS[kind].solid && kind !== 'glass' && kind !== 'door'
}

/**
 * Pulls the trigger of the grappling hook. With the hook out (on a line, parked or flying) it lets go and reels it
 * back instead, so the same click shoots and releases. `direction` must be a unit vector.
 */
export function fireGrapple(world: World, from: Vec, direction: Vec): void {
  const grapple = world.grapple
  if (grapple.phase === 'flying') return
  if (grapple.phase !== 'stowed') return releaseHook(world)
  Object.assign(grapple, { phase: 'flying', hook: { ...from }, heading: { ...direction }, travelled: 0, anchor: null, bend: null })
  playSound(world, 'switch', from)
}

/** Lets go of the line and reels the hook in. Whoever hung on it keeps the speed he had. */
export function releaseHook(world: World): void {
  const grapple = world.grapple
  if (grapple.phase === 'attached' && grapple.hanging) letGoOfLine(world)
  Object.assign(grapple, { phase: 'retracting', anchor: null, bend: null, hanging: false, reeling: 0 })
}

/** Hands the player's swing back to the ordinary movement code. */
export function letGoOfLine(world: World): void {
  const grapple = world.grapple
  world.player.vx = grapple.vel.x
  world.player.vy = grapple.vel.y
  grapple.hanging = false
  grapple.reeling = 0
}

/** Moves a hook in flight or on its way back. */
export function stepHook(world: World, dt: number): void {
  const grapple = world.grapple
  if (grapple.phase === 'flying') fly(world, grapple, dt)
  else if (grapple.phase === 'retracting') retract(world, grapple, dt)
}

function fly(world: World, grapple: GrappleState, dt: number): void {
  const reach = Math.min(HOOK_SPEED * dt, HOOK_RANGE - grapple.travelled)
  const hit = castRay(world.grid, grapple.hook, grapple.heading, reach, (kind) => TILE_DEFS[kind].solid)
  if (!hit) {
    grapple.hook = along(grapple.hook, grapple.heading, reach)
    grapple.travelled += reach
    if (grapple.travelled >= HOOK_RANGE - 1e-6) grapple.phase = 'retracting'
    return
  }
  const point = along(grapple.hook, grapple.heading, Math.max(0, hit.distance - BITE_STANDOFF))
  grapple.hook = point
  playSound(world, 'impact', point)
  if (!holdsHook(hit.kind)) {
    // It glances off; a tap on glass is about as loud as a knock.
    emitNoise(world, point, BITE_NOISE * 0.5)
    grapple.phase = 'retracting'
    return
  }
  emitNoise(world, point, BITE_NOISE)
  burst(world.effects, world.rng, point, 3, TILE_DEFS[hit.kind].color, 3)
  Object.assign(grapple, { phase: 'attached', anchor: { x: hit.tileX, y: hit.tileY }, bend: null, hanging: false })
  grapple.length = distance(gripOf(world.player), point)
}

function retract(world: World, grapple: GrappleState, dt: number): void {
  const hand = gripOf(world.player)
  const gap = distance(hand, grapple.hook)
  const step = RETRACT_SPEED * dt
  if (gap <= step) {
    grapple.phase = 'stowed'
    grapple.hook = hand
    return
  }
  grapple.hook = along(grapple.hook, { x: (hand.x - grapple.hook.x) / gap, y: (hand.y - grapple.hook.y) / gap }, step)
}

function along(from: Vec, heading: Vec, reach: number): Vec {
  return { x: from.x + heading.x * reach, y: from.y + heading.y * reach }
}

/**
 * The same things that cut a climbing rope cut the line: the bitten tile destroyed, fire at the hook, or a blast
 * close to it. Explosions are spotted from the 'explosion' flash each one leaves, as the frag aftermath does.
 */
const seenBlasts = new WeakSet<object>()

export function lineIsCut(world: World): boolean {
  const grapple = world.grapple
  let cut = false
  for (const blast of world.effects.flashes) {
    if (blast.kind !== 'explosion' || seenBlasts.has(blast)) continue
    seenBlasts.add(blast)
    if (grapple.anchor && distance(blast, grapple.hook) <= blast.radius + 0.5) cut = true
  }
  if (!grapple.anchor) return false
  return cut || !holdsHook(tileAt(world.grid, grapple.anchor.x, grapple.anchor.y)) || isBurningAt(world, grapple.hook)
    || isBurningAt(world, { x: grapple.anchor.x + 0.5, y: grapple.anchor.y + 0.5 })
}

/** The hook tears out and falls; anyone on the line drops. */
export function cutLine(world: World): void {
  const grapple = world.grapple
  if (grapple.phase === 'attached' && grapple.hanging) letGoOfLine(world)
  burst(world.effects, world.rng, grapple.hook, 6, LINE_FIBRE, 4)
  playSound(world, 'impact', grapple.hook)
  Object.assign(grapple, { phase: 'stowed', anchor: null, bend: null, hanging: false, reeling: 0, vaultToLine: false })
}
