import type { PropState } from '../cover'
import { releaseHook } from '../grapple/hook'
import { onLine } from '../grapple/state'
import type { Guard } from '../guards'
import { propBox } from '../hazards/props'
import { JOINT, wake } from '../ragdoll'
import { eyeOf, isActive, setMode } from '../security/model'
import { hasTorchOut, lightFactor, playerLight, zoneOf } from '../security/perception'
import { VISION } from '../security/tuning'
import { centerOf, distance, type Vec } from '../types'
import { hasLineOfSight } from '../vision'
import type { World } from '../world'
import { bodiesIn, nearestSpot, spotFeet, spotKind, spotProp } from './spots'
import { HIDE } from './tuning'

/**
 * The player hiding in furniture: E to get into a locker, wardrobe, stall or dumpster, or to crawl under a desk or
 * bed; E again to get out. Hidden, he cannot be seen or shoot, but he sees out (the room and the guards' cones stay
 * on screen). A guard who saw him get in comes and opens it. Searching guards open hiding places too (search.ts).
 */

/** A hiding place the player could get into from here, with room left for him. */
export function spotForPlayer(world: World): PropState | null {
  const player = world.player
  // Only from his own two feet: halfway up a ledge, a ladder, the stairs or the line he would be hidden there and the
  // climb would carry on (or resume on the way out) with him inside.
  if (!player.onGround || player.mantle || player.onLadder || player.stairs || onLine(world.grapple)) return null
  const feet = { x: player.x + player.w / 2, y: player.y + player.h }
  return nearestSpot(world, feet, (prop, kind) => kind.player && kind.how !== 'behind' && bodiesIn(world, prop).length < kind.bodies)
}

export function hidePrompt(prop: PropState): string {
  const kind = spotKind(prop.kind)!
  return kind.how === 'under' ? `E: crawl under ${kind.name}` : `E: hide in ${kind.name}`
}

export function enterSpot(world: World, prop: PropState): void {
  const kind = spotKind(prop.kind)!
  const player = world.player
  const feet = spotFeet(prop)
  // Anyone who sees him climb in knows where he is.
  const watchers = world.guards.filter((guard) => seesClimbingIn(world, guard))
  world.stealth.hiding = { prop: prop.id, how: kind.how === 'under' ? 'under' : 'inside' }
  Object.assign(player, { x: feet.x - player.w / 2, vx: 0, vy: 0, hidden: true })
  // Climbing in takes both hands: a slack grapple line still bitten somewhere is let go, or reeling it in (W) would
  // haul him up out of the locker.
  if (world.grapple.phase === 'attached') releaseHook(world)
  for (const guard of watchers) comeToOpen(world, guard, prop)
}

/**
 * Does this guard see the player get in? His central cone, walls and light as usual; the furniture itself does not
 * count, since the player is stepping into it.
 */
function seesClimbingIn(world: World, guard: Guard): boolean {
  if (!isActive(guard) || guard.blindSeconds > 0) return false
  const eye = eyeOf(guard)
  const body = centerOf(world.player)
  if (zoneOf(guard, eye, body) !== 'central' || !hasLineOfSight(world.grid, eye, body)) return false
  const darkRange = hasTorchOut(guard) ? VISION.torchDarkRange : VISION.darkRange
  return lightFactor(playerLight(world), distance(eye, body), darkRange) > 0
}

/** Gets out in front of the hiding place. */
export function leaveSpot(world: World): void {
  const hiding = world.stealth.hiding
  if (!hiding) return
  world.stealth.hiding = null
  world.player.hidden = false
  const prop = spotProp(world, hiding.prop)
  if (prop) world.player.x = spotFeet(prop).x - world.player.w / 2
}

/** A guard walking right past the front of the hiding place, who has no idea: the one to grab on the way out. */
export function passerBy(world: World): Guard | null {
  const hiding = world.stealth.hiding
  const prop = hiding && spotProp(world, hiding.prop)
  if (!prop) return null
  const box = propBox(prop)
  const feet = box.y + box.h
  return world.guards.find((guard) => guard.mode !== 'dead' && !guard.out && guard.state !== 'alert' && !guard.restrained && guard.mode !== 'surrendered'
    && Math.abs(guard.y + guard.h - feet) < 0.8 && centerOf(guard).x > box.x - 1 && centerOf(guard).x < box.x + box.w + 1) ?? null
}

/**
 * A hiding place blown apart, burnt or carried off by a falling floor no longer hides anything: the player is out in
 * the open where he is (and falls if the floor went), and the bodies inside spill out where they lay.
 */
export function stepSpots(world: World): void {
  const hiding = world.stealth.hiding
  if (hiding && !stillHides(world, hiding.prop, centerOf(world.player).x, world.player.y + world.player.h)) {
    world.stealth.hiding = null
    world.player.hidden = false
  }
  for (const guard of world.guards) {
    if (guard.hiddenIn === null || !guard.ragdoll) continue
    const hip = guard.ragdoll.points[JOINT.hip]
    if (stillHides(world, guard.hiddenIn, hip.x, hip.y)) continue
    guard.hiddenIn = null
    wake(guard.ragdoll)
  }
}

/** Is this hiding place whole and still where the person (or body) inside it was put? */
function stillHides(world: World, id: number, x: number, feetY: number): boolean {
  const prop = spotProp(world, id)
  if (!prop || prop.broken) return false
  const front = spotFeet(prop)
  return Math.abs(front.x - x) < 1.5 && Math.abs(front.y - feetY) < 1.5
}

/** A guard who saw the player get in walks over to open it. */
export function comeToOpen(world: World, guard: Guard, prop: PropState): void {
  world.stealth.watched.set(prop.id, world.guards.indexOf(guard))
  guard.interest = { at: spotFeet(prop), kind: 'glimpse', priority: 5, reached: false }
  setMode(guard, 'investigating')
}

/** Guards walking over to a hiding place they saw someone get into: close enough, they open it. */
export function stepWatched(world: World, open: (guard: Guard, prop: PropState) => void): void {
  for (const [id, index] of world.stealth.watched) {
    const guard = world.guards[index]
    const prop = spotProp(world, id)
    if (!prop || guard.mode === 'dead' || guard.out || guard.stunSeconds > 0) {
      world.stealth.watched.delete(id)
      continue
    }
    const feet: Vec = { x: guard.x + guard.w / 2, y: guard.y + guard.h }
    const front = spotFeet(prop)
    if (Math.abs(feet.y - front.y) > 1 || Math.abs(feet.x - front.x) > HIDE.openReach + propBox(prop).w / 2) continue
    world.stealth.watched.delete(id)
    open(guard, prop)
  }
}
