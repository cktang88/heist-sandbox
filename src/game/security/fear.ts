import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { barkLine } from './barks'
import { alreadyCalling, startRadio } from './comms'
import { eyeOf, feetOf, isActive, magazineOf, setMode, type Guard } from './model'
import { goTo, hold } from './movement'
import { isShaken, recentDeathIn } from './nerve'
import { followGuard, nearestFree, startSearch } from './orders'
import { clearView } from './perception'
import { buildingAt, floorBelow, roomOf, sameFloor, travelCost } from './places'
import { FEAR, NERVE, PATROL, TIERS } from './tuning'

/**
 * What a guard does when his nerve goes: run for the nearest security room and hide there, or, with the
 * intruder right on him, drop his weapon and put his hands up. A surrendered guard stays put while he is
 * watched; left alone for long enough he picks the weapon back up. Nerve that recovers (the shock fades,
 * colleagues arrive) brings a panicking guard back to his senses.
 */

const COWER_TURN = 3
const FLEE_DISTANCE = 14
/** Unwatched time a surrendered guard needs before he dares move, by experience. */
const REARM_BY_TIER = { rookie: 1.5, regular: 1, veteran: 0.7 } as const

/** Nerve gone: give up if the intruder is right there and looking, otherwise run. */
export function breakDown(world: World, guard: Guard): void {
  clearPlans(guard)
  if (playerIsOn(world, guard, FEAR.surrenderRange)) {
    surrender(world, guard)
    return
  }
  setMode(guard, 'panic')
  guard.announced = 'panic'
  guard.target = refugeFor(world, guard)
  barkLine(world, guard, 'panic', true)
}

/** Drops his weapon at his feet and raises his hands. */
export function surrender(world: World, guard: Guard): void {
  clearPlans(guard)
  setMode(guard, 'surrendered')
  guard.announced = 'surrendered'
  const feet = feetOf(guard)
  guard.droppedWeapon = { x: feet.x + guard.facing * 0.7, y: feet.y }
  guard.unwatchedSeconds = 0
  guard.crouching = false
  guard.vx = 0
  barkLine(world, guard, 'surrender', true)
}

/** Ties up a surrendered (or stunned) guard: he stays where he is, alive, for good. */
export function restrainGuard(world: World, guard: Guard): void {
  if (guard.mode === 'dead') return
  if (guard.mode !== 'surrendered') surrender(world, guard)
  guard.restrained = true
  guard.stunSeconds = 0
}

/** His nerve came back: he stops running, says so, and goes back to being careful. */
export function pullTogether(world: World, guard: Guard): void {
  barkLine(world, guard, 'recovered', true)
  guard.target = null
  guard.crouching = false
  const lead = guard.lastKnown
  startSearch(world, guard, lead ? floorBelow(world, lead) : feetOf(guard))
  if (lead) startRadio(world, guard, { kind: 'sighting', at: { ...lead }, by: world.guards.indexOf(guard) })
}

/** Running for cover, then cowering there. If the intruder comes right up to him, he gives up. */
export function panicBehaviour(world: World, guard: Guard, dt: number): void {
  if (playerIsOn(world, guard, FEAR.surrenderRange / 2)) {
    surrender(world, guard)
    return
  }
  const refuge = guard.target
  const feet = feetOf(guard)
  if (refuge && !(sameFloor(feet, refuge) && Math.abs(feet.x - refuge.x) < 0.6)) {
    if (goTo(world, guard, refuge, PATROL.runSpeed, dt, false) !== 'blocked') return
    guard.target = null
  }
  cower(world, guard, dt)
}

function cower(world: World, guard: Guard, dt: number): void {
  hold(world, guard, dt)
  guard.crouching = true
  const threat = guard.lastKnown
  if (threat) guard.facing = threat.x > feetOf(guard).x ? -1 : 1
  if (Math.floor(guard.modeSeconds / COWER_TURN) !== Math.floor((guard.modeSeconds - dt) / COWER_TURN)) barkLine(world, guard, 'cower')
}

/**
 * Hands up while watched. Unwatched for long enough, he goes back for his weapon, then gets on the radio
 * and joins the search: leaving a surrendered guard behind is a gamble.
 */
export function surrenderedBehaviour(world: World, guard: Guard, dt: number): void {
  guard.crouching = false
  if (guard.restrained || !guard.droppedWeapon || playerIsOn(world, guard, FEAR.watchRange)) {
    guard.unwatchedSeconds = 0
    hold(world, guard, dt)
    return
  }
  guard.unwatchedSeconds += dt
  if (guard.unwatchedSeconds < FEAR.rearmSeconds * REARM_BY_TIER[guard.tier]) {
    hold(world, guard, dt)
    return
  }
  if (goTo(world, guard, guard.droppedWeapon, PATROL.hurrySpeed, dt, false) === 'moving') return
  guard.droppedWeapon = null
  guard.rounds = magazineOf(guard.armored)
  // Armed again, he is as steady as a guard who has just pulled himself together.
  guard.shock = Math.max(0, TIERS[guard.tier].nerve - NERVE.recovered)
  guard.nerve = NERVE.recovered
  barkLine(world, guard, 'rearm', true)
  const lead = guard.lastKnown ?? centerOf(world.player)
  startSearch(world, guard, floorBelow(world, lead))
  startRadio(world, guard, { kind: 'sighting', at: { ...lead }, by: world.guards.indexOf(guard) })
}

/** Is the player close and in plain view of this guard (either way he faces: he knows where the man is)? */
function playerIsOn(world: World, guard: Guard, range: number): boolean {
  const body = centerOf(world.player)
  const eye = eyeOf(guard)
  return world.status === 'playing' && distance(eye, body) <= range && clearView(world, eye, body)
}

/** The nearest security room in his building, if one is in reach; otherwise a spot well away from the threat. */
function refugeFor(world: World, guard: Guard): Vec {
  const feet = feetOf(guard)
  const building = buildingAt(world, feet)
  const here = roomOf(world, feet)
  let best: Vec | null = here?.kind === 'security' ? feet : null
  let bestCost = best ? 0 : FEAR.refugeReach
  for (const room of world.rooms) {
    if (room.kind !== 'security' || room.building !== building) continue
    const spot = { x: room.x + room.w / 2, y: room.floorY }
    const cost = travelCost(feet, spot)
    if (cost < bestCost) {
      best = spot
      bestCost = cost
    }
  }
  if (best) return best
  const threat = guard.lastKnown ?? centerOf(world.player)
  return { x: feet.x + Math.sign(feet.x - threat.x || -guard.facing) * FLEE_DISTANCE, y: feet.y }
}

function clearPlans(guard: Guard): void {
  guard.radio = null
  guard.search = null
  guard.follow = null
  guard.cover = null
  guard.interest = null
  guard.station = null
  guard.blindFiring = false
  guard.bounding = false
  guard.flashWindup = 0
}

/** What a shaken guard will not walk into alone. */
const DANGEROUS = new Set(['body', 'gunfire', 'shout', 'order', 'tamper'])
const PARTNER_CLOSE = 3

/**
 * Low nerve on the way to trouble. Shaken and without a partner, he calls for one and waits (for a while);
 * at the edge of a room where a colleague was just killed, he stops and steels himself first, longer the
 * more frightened he is. Returns true while he holds back.
 */
export function holdsBack(world: World, guard: Guard, goal: Vec, dt: number): boolean {
  const kind = guard.interest?.kind
  if (!kind || !DANGEROUS.has(kind)) return false
  if (guard.hesitateSeconds > 0) {
    guard.hesitateSeconds -= dt
    faceAndWait(world, guard, goal, dt)
    return true
  }
  if (waitsForPartner(world, guard, dt)) {
    faceAndWait(world, guard, goal, dt)
    return true
  }
  const room = roomOf(world, goal)
  const feet = feetOf(guard)
  if (!room || room.id === guard.hesitatedRoom || roomOf(world, feet)?.id === room.id || !sameFloor(feet, goal)) return false
  const edge = feet.x < room.x ? room.x - feet.x : feet.x - (room.x + room.w)
  if (edge > FEAR.hesitateReach || !recentDeathIn(world, room.id, FEAR.deathMemory)) return false
  guard.hesitatedRoom = room.id
  guard.hesitateSeconds = (FEAR.hesitateMin + world.rng() * (FEAR.hesitateMax - FEAR.hesitateMin)) * (1.4 - guard.nerve)
  barkLine(world, guard, 'hesitate', true)
  faceAndWait(world, guard, goal, dt)
  return true
}

function waitsForPartner(world: World, guard: Guard, dt: number): boolean {
  if (!isShaken(guard) || guard.follow !== null || guard.partnerWait >= FEAR.partnerWaitMax) return false
  const index = world.guards.indexOf(guard)
  const partner = world.guards.find((other) => other.follow === index && isActive(other))
  if (partner && distance(feetOf(partner), feetOf(guard)) < PARTNER_CLOSE) {
    if (guard.partnerWait > 0) barkLine(world, guard, 'partnerHere', true)
    guard.partnerWait = FEAR.partnerWaitMax
    return false
  }
  if (guard.partnerWait === 0) {
    barkLine(world, guard, 'alone', true)
    const helper = partner ?? nearestFree(world, feetOf(guard), 1)[0]
    if (helper && !partner) {
      followGuard(world, helper, guard)
      barkLine(world, helper, 'orderAck')
    }
    // Nobody close: he gets on the radio while he waits. A body is reported as one; anything else as a call for help.
    if (!helper) callItIn(world, guard)
  }
  guard.partnerWait += dt
  return true
}

function faceAndWait(world: World, guard: Guard, goal: Vec, dt: number): void {
  hold(world, guard, dt)
  guard.facing = goal.x >= feetOf(guard).x ? 1 : -1
}

function callItIn(world: World, guard: Guard): void {
  const interest = guard.interest
  if (!interest) return
  const by = world.guards.indexOf(guard)
  const body = interest.body
  if (body !== undefined && !world.security.reportedBodies.has(body)) {
    const hip = world.guards[body].ragdoll?.points[2] ?? interest.at
    if (!alreadyCalling(world, 'body', hip)) startRadio(world, guard, { kind: 'body', at: { x: hip.x, y: hip.y }, by })
    return
  }
  guard.backupAt = world.clock
  startRadio(world, guard, { kind: 'backup', at: feetOf(guard), by })
}
