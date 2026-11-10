import { GRAVITY, moveBody } from '../physics'
import { centerOf, distance, type Body, type Vec } from '../types'
import { hasLineOfSight } from '../vision'
import type { World } from '../world'
import { barkLine, nameOf } from './barks'
import { shelteredFrom } from './coverSpots'
import { goTo } from './movement'
import { eyeOf, feetOf, isActive, type Guard } from './model'
import { frighten, isShaken } from './nerve'
import { isDoorway, sameFloor } from './places'
import { NERVE, PATROL, UNDER_FIRE } from './tuning'

/**
 * Staying alive: diving away from a grenade that lands close (and shouting it), hauling a badly wounded colleague
 * out of the line of fire when he is right there, and never stopping in a doorway during a fight.
 */

const DIVE_LIFT = 4
const DIVE_DRAG = 2
const GRENADE_FLOOR = 2.5
const DRAG_STEP = 3
const DRAG_HOLD = 0.9
const DRAG_REACH_LOST = 2.5
const DOORWAY_STEP = 1.5

/** A live frag, flashbang or smoke grenade of the player's close by and in view: dive away from it and shout. Returns true if he dove. */
export function watchForGrenades(world: World, guard: Guard): boolean {
  if (guard.diveSeconds > 0 || !isActive(guard) || guard.mode === 'panic' || guard.blindSeconds > 0) return false
  const body = centerOf(guard)
  const close = (item: Body) => {
    const at = centerOf(item)
    return Math.abs(at.y - body.y) < GRENADE_FLOOR && distance(at, body) < UNDER_FIRE.diveRange && hasLineOfSight(world.grid, eyeOf(guard), at)
  }
  const grenade = world.frags.find(close) ?? world.hazards.grenades.find((item) => !item.popped && item.thrower === 'player' && close(item))
  if (!grenade) return false
  const away = Math.sign(body.x - centerOf(grenade).x) || -guard.facing
  guard.diveSeconds = UNDER_FIRE.diveSeconds
  guard.vx = away * UNDER_FIRE.diveSpeed
  guard.vy = -DIVE_LIFT
  guard.facing = away > 0 ? 1 : -1
  guard.radio = null
  guard.stairs = null
  guard.climbing = false
  frighten(guard, NERVE.grenade)
  barkLine(world, guard, 'grenade', true)
  return true
}

/** Flying, then flat on the floor, until the dive is over. */
export function stepDive(world: World, guard: Guard, dt: number): void {
  guard.diveSeconds = Math.max(0, guard.diveSeconds - dt)
  guard.crouching = true
  guard.vy += GRAVITY * dt
  if (guard.onGround) guard.vx *= Math.max(0, 1 - DIVE_DRAG * dt * 4)
  moveBody(world.grid, guard, dt)
  if (guard.diveSeconds === 0) guard.vx = 0
}

/**
 * A badly wounded colleague right beside him and out in the open: grab him and back off with him.
 * Only a guard who is not shooting, not shaken and not reloading does it. Returns true while dragging.
 */
export function dragWounded(world: World, guard: Guard, threat: Vec, dt: number): boolean {
  if (isShaken(guard) || guard.reloadSeconds > 0) return false
  const index = world.guards.indexOf(guard)
  const feet = feetOf(guard)
  let casualty = world.guards.find((other) => other.draggedBy === index)
  if (!casualty) {
    casualty = world.guards.find((other) => other !== guard && needsPulling(world, other, feet, threat))
    if (!casualty) return false
    casualty.draggedBy = index
    casualty.dragSeconds = UNDER_FIRE.dragSeconds
    barkLine(world, guard, 'drag', true, nameOf(world.guards.indexOf(casualty)))
  }
  const away = Math.sign(feet.x - threat.x) || -guard.facing
  goTo(world, guard, { x: feet.x + away * DRAG_STEP, y: feet.y }, PATROL.walkSpeed, dt, false)
  guard.facing = away > 0 ? -1 : 1
  return true
}

function needsPulling(world: World, other: Guard, feet: Vec, threat: Vec): boolean {
  if (other.mode === 'dead' || other.restrained || other.draggedBy !== null || other.hp >= other.maxHp * UNDER_FIRE.dragHealth) return false
  const at = feetOf(other)
  if (!sameFloor(at, feet) || Math.abs(at.x - feet.x) > UNDER_FIRE.dragReach) return false
  return !shelteredFrom(world, at, threat, other.crouching)
}

/** Being hauled along at his rescuer's side. Returns false (and lets go) once the drag is over. */
export function beingDragged(world: World, guard: Guard, dt: number): boolean {
  const rescuer = guard.draggedBy === null ? undefined : world.guards[guard.draggedBy]
  guard.dragSeconds -= dt
  if (!rescuer || !isActive(rescuer) || rescuer.mode !== 'combat' || guard.dragSeconds <= 0 || distance(feetOf(rescuer), feetOf(guard)) > DRAG_REACH_LOST) {
    guard.draggedBy = null
    return false
  }
  const spot = feetOf(rescuer).x + rescuer.facing * DRAG_HOLD
  guard.crouching = true
  guard.vx = Math.max(-PATROL.hurrySpeed, Math.min(PATROL.hurrySpeed, (spot - feetOf(guard).x) * 8))
  guard.vy += GRAVITY * dt
  moveBody(world.grid, guard, dt)
  return true
}

/** The spot moved back out of any doorway it lands in, away from the threat. */
export function clearOfDoorway(world: World, spot: Vec & { high: boolean }, threat: Vec): Vec & { high: boolean } {
  const away = Math.sign(spot.x - threat.x) || 1
  for (const offset of [0, -0.5, 0.5]) {
    if (isDoorway(world, spot.x + offset, spot.y)) return { ...spot, x: spot.x + away * DOORWAY_STEP }
  }
  return spot
}
