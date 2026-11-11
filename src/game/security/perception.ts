import { sightBlockedByProps } from '../cover'
import { smokeBetween } from '../hazards/hazards'
import { lightLevelAt } from '../light'
import { centerOf, distance, type Vec } from '../types'
import { hasLineOfSight } from '../vision'
import type { World } from '../world'
import { bodyAt, bodyInOpen } from '../stealth/bodies'
import { disguiseFactor } from '../stealth/disguise'
import { shelteredFrom } from './coverSpots'
import { eyeOf, type Guard } from './model'
import { AWARENESS, VISION } from './tuning'

/**
 * What a guard can see. Vision is a central cone that properly sees, plus a wide near zone and a
 * sliver behind that only catch movement. Walls, smoke and tall furniture block it, darkness hides,
 * crouching and keeping still help, and low cover hides a crouching body from a guard on the same level.
 */

export type Zone = 'central' | 'peripheral' | 'rear'
/** How fast the awareness meter fills from seeing the player (per second), and whether that zone alone may only make the guard curious. */
export type Detection = { rate: number; zone: Zone }

const SMOKE_BLOCKS = 0.6
/** Closer than this (side to side) a guard feels as much as sees the man next to him. */
const BUMP = 1.1

/** Guards with their guard up (searching, fighting, running to raise the alarm) look further and wider. */
export function isAlerted(guard: Guard): boolean {
  return guard.mode === 'searching' || guard.mode === 'combat' || guard.mode === 'toAlarm'
}

/** Investigating or on guard: his torch is out, so he sees further into the dark. */
export function hasTorchOut(guard: Guard): boolean {
  return isAlerted(guard) || guard.mode === 'investigating'
}

/**
 * The vision cone a renderer should draw: centre angle (radians, y down), half-angle and range.
 * A fighting guard looks where his gun points, which may be straight up through a hole; everyone else looks ahead.
 */
export function visionOf(guard: Guard): { angle: number; halfAngle: number; range: number } {
  const alerted = isAlerted(guard)
  return {
    angle: guard.mode === 'combat' ? Math.atan2(guard.aim.y, guard.aim.x) : guard.facing > 0 ? 0 : Math.PI,
    halfAngle: alerted ? VISION.alertHalfAngle : VISION.centralHalfAngle,
    range: alerted ? VISION.alertRange : VISION.centralRange,
  }
}

export function zoneOf(guard: Guard, eye: Vec, target: Vec): Zone | null {
  const dx = target.x - eye.x
  const dy = target.y - eye.y
  const gap = Math.hypot(dx, dy)
  const { angle: centre, halfAngle, range } = visionOf(guard)
  const angle = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - centre), Math.cos(Math.atan2(dy, dx) - centre)))
  if (gap <= range && angle <= halfAngle) return 'central'
  if (gap <= VISION.peripheralRange && angle <= VISION.peripheralHalfAngle) return 'peripheral'
  if (gap <= VISION.rearRange) return 'rear'
  return null
}

/** Nothing solid, no thick smoke and no tall furniture between two points. */
export function clearView(world: World, from: Vec, to: Vec): boolean {
  return hasLineOfSight(world.grid, from, to) && smokeBetween(world, from, to) < SMOKE_BLOCKS && !sightBlockedByProps(world, from, to)
}

/** Could this guard see that point right now, in his central cone, if it were lit? */
export function canSee(world: World, guard: Guard, target: Vec): boolean {
  if (guard.blindSeconds > 0 || guard.mode === 'dead') return false
  const eye = eyeOf(guard)
  return zoneOf(guard, eye, target) === 'central' && clearView(world, eye, target)
}

const lightCache = new WeakMap<World, { clock: number; x: number; y: number; level: number }>()

/** The light on the player's body, worked out once per frame because many guards ask. */
export function playerLight(world: World): number {
  const at = centerOf(world.player)
  const cached = lightCache.get(world)
  if (cached && cached.clock === world.clock && cached.x === at.x && cached.y === at.y) return cached.level
  const level = lightLevelAt(world, at)
  lightCache.set(world, { clock: world.clock, x: at.x, y: at.y, level })
  return level
}

/** How much the light helps a guard make out a body at this distance: 1 in full light, 0 when it is too dark to see. */
export function lightFactor(light: number, gap: number, darkRange: number): number {
  if (light >= VISION.lit) return 1
  if (light >= VISION.dim) return AWARENESS.dimFactor + ((light - VISION.dim) / (VISION.lit - VISION.dim)) * (1 - AWARENESS.dimFactor)
  return gap <= darkRange ? AWARENESS.darkCloseFactor : 0
}

/** Closer is faster: twice the base rate at two tiles, a third of it at the edge of the cone. */
function distanceFactor(gap: number): number {
  return Math.max(0.35, Math.min(2, 2.4 - 0.16 * gap))
}

/** How the player is being seen by this guard right now, or null if not at all. */
export function detectPlayer(world: World, guard: Guard): Detection | null {
  // Shut in a locker or flat under a desk, he is out of sight until someone opens it (stealth/search.ts).
  if (guard.blindSeconds > 0 || world.player.hidden) return null
  const player = world.player
  const eye = eyeOf(guard)
  const body = centerOf(player)
  const head = { x: body.x, y: player.y + 0.3 }
  // Walking into someone in front of him is noticed: up close the cone's edge would miss a man at his elbow.
  const touching = (body.x - eye.x) * guard.facing > -0.1 && Math.abs(eye.x - body.x) < BUMP && Math.abs(eye.y - body.y) < 1.2
  const zone = touching ? 'central' : zoneOf(guard, eye, body) ?? zoneOf(guard, eye, head)
  if (!zone) return null
  const moving = Math.abs(player.vx) > 0.6 || Math.abs(player.vy) > 1.5
  if (zone !== 'central' && !moving) return null
  if (!clearView(world, eye, body) && !clearView(world, eye, head)) return null

  const gap = distance(eye, body)
  const crouching = player.crouching
  const darkRange = (hasTorchOut(guard) ? VISION.torchDarkRange : VISION.darkRange) * (crouching ? 0.6 : 1)
  const light = lightFactor(playerLight(world), gap, darkRange)
  if (light <= 0) return null
  const level = Math.abs(eye.y - body.y) < 2.5
  if (crouching && level && gap > 3 && shelteredFrom(world, { x: body.x, y: player.y + player.h }, eye, true)) return null

  const motion = Math.abs(player.vx) > 5 ? AWARENESS.runFactor : moving ? 1 : AWARENESS.stillFactor
  const stance = crouching ? AWARENESS.crouchFactor : 1
  const zoneRate = zone === 'central' ? 1 : AWARENESS.peripheralRate
  const uniform = disguiseFactor(world)
  if (uniform <= 0) return null
  return { rate: (distanceFactor(gap) * light * motion * stance * zoneRate * uniform) / AWARENESS.fillSeconds, zone }
}

/**
 * A colleague's body this guard can see and has not seen before (guard index), if any: dead or out cold, lying in
 * the open. The same rules as for seeing the player: his central cone, a clear view, enough light, and low cover
 * hides a body (it lies on the floor) from a guard on the same level.
 */
/** A body this close along the floor (horizontally from his eye) is noticed whatever the light or his cone. */
const UNDERFOOT = 1

export function spotBody(world: World, guard: Guard): number | null {
  const eye = eyeOf(guard)
  const darkRange = hasTorchOut(guard) ? VISION.torchDarkRange : VISION.darkRange
  for (let index = 0; index < world.guards.length; index += 1) {
    const other = world.guards[index]
    if (!bodyInOpen(world, other) || guard.bodiesSeen.includes(index)) continue
    const at = bodyAt(other)
    // A man lying right at his feet is below his eye line but not missed: he all but steps on him.
    const underfoot = Math.abs(at.x - eye.x) < UNDERFOOT && at.y > eye.y && at.y - eye.y < 2
    if (underfoot) return index
    if (zoneOf(guard, eye, at) !== 'central' || !clearView(world, eye, at)) continue
    const gap = distance(eye, at)
    if (lightFactor(lightLevelAt(world, at), gap, darkRange) <= 0) continue
    if (Math.abs(eye.y - at.y) < 2.5 && gap > 3 && shelteredFrom(world, { x: at.x, y: at.y + 0.3 }, eye, true)) continue
    return index
  }
  return null
}
