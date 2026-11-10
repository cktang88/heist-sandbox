import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { barkLine } from './barks'
import { roundReaches, exposedTo, GUARD_PISTOL } from './lineOfFire'
import { eyeOf, feetOf, isActive, type Guard } from './model'
import { goTo } from './movement'
import { clearView } from './perception'
import { floorBelow, sameFloor } from './places'
import { findShelter, shelterHolds } from './shelter'
import { PATROL, SHELTER, UNDER_FIRE } from './tuning'

/**
 * Being shot at. Gunfire is a target: a guard who hears the intruder's gun with a clear line to it, or has rounds
 * crack past him, knows where the shooter is, in any direction, up through a hole in the ceiling included.
 * Anyone under fire, or who has just seen a colleague hit, does not stand in the open: he gets to a spot the shooter's
 * rounds cannot reach (shelter.ts), kneels there, and comes up to fire back in short peeks. With nowhere to hide he
 * gets out of the way.
 */

const WITNESS_REACH = 16
/** A threat this far from where the shelter was chosen means a new one. */
const THREAT_MOVED = 3
const ARRIVED = 0.4
/** Duck cycles (a second or two each) he sits out in a shelter he cannot fire from before he gives it up. */
const NO_PEEK_WAITS = 3

/** Was this bang the intruder's own gun? Guards can tell a shot from a thrown bottle or a grenade landing somewhere else. */
export function isShooterAt(world: World, at: Vec): boolean {
  return distance(at, centerOf(world.player)) < 2.5
}

/** Gunfire this close with nothing solid in the way: the guard knows exactly where it came from. */
export function locates(world: World, guard: Guard, at: Vec): boolean {
  const ear = eyeOf(guard)
  return distance(ear, at) < SHELTER.locateReach && roundReaches(world, at, ear, GUARD_PISTOL)
}

/**
 * He knows where the shooter is right now (heard him, or the rounds came from there). A shooter this close is firing
 * into the room he is standing in, which counts as being under fire.
 */
export function locateShooter(world: World, guard: Guard, at: Vec): void {
  guard.heardAt = world.clock
  if (distance(eyeOf(guard), at) < SHELTER.closeFire) guard.underFireAt = world.clock
  if (guard.seesPlayer) return
  guard.lastKnown = { ...at }
  guard.lastKnownAt = world.clock
}

/** Rounds came his way: he knows where from, and he wants out of their line. */
export function markUnderFire(world: World, guard: Guard, from: Vec): void {
  guard.underFireAt = world.clock
  locateShooter(world, guard, from)
}

/** A colleague was just hit: everyone fighting who saw it wants out of the open too. */
export function witnessHit(world: World, victim: Guard): void {
  const at = centerOf(victim)
  for (const other of world.guards) {
    if (other === victim || !isActive(other) || other.mode !== 'combat') continue
    const eye = eyeOf(other)
    if (distance(eye, at) < WITNESS_REACH && clearView(world, eye, at)) other.underFireAt = world.clock
  }
}

export function underFire(world: World, guard: Guard): boolean {
  return world.clock - guard.underFireAt < SHELTER.memory
}

/**
 * Takes over a fighting guard's movement while he is under fire, or can see the shooter on another floor (through a
 * hole or down a stairwell, where walking over is no answer): to shelter, down, and up again to peek.
 * Returns false when he is not threatened, or is already safe where he stands, so his squad role decides.
 */
export function takeShelter(world: World, guard: Guard, known: Vec, dt: number): boolean {
  const feet = feetOf(guard)
  const acrossFloors = guard.seesPlayer && !sameFloor(feet, floorBelow(world, known))
  if (!underFire(world, guard) && !acrossFloors) return leaveShelter(guard)
  if (guard.stairs || guard.climbing) return false
  if (!guard.shelter || distance(guard.shelter.from, known) > THREAT_MOVED) {
    if (!guard.shelter && !exposedTo(world, known, feet, guard.crouching)) return false
    guard.shelter = findShelter(world, guard, known, SHELTER.reach, guard.combatRole === 'fallback')
    guard.peeking = false
    guard.peekSeconds = duckSeconds(world)
    barkLine(world, guard, 'takingFire')
  }
  const shelter = guard.shelter
  const pinned = guard.suppression > UNDER_FIRE.duckAbove
  if (shelter.spent) return false
  if (!shelter.hidden) {
    // Nowhere to hide: out of the way, bent double if rounds are cracking past.
    const status = goTo(world, guard, shelter, PATROL.runSpeed, dt, false)
    guard.crouching = pinned || status !== 'moving'
    guard.peeking = false
    // As far as he can get: from here he fights by his role (goes round, pushes up, fires back) rather than wait.
    if (status !== 'moving') shelter.spent = true
    return true
  }
  guard.peekSeconds -= dt
  if (guard.peekSeconds <= 0) {
    const peekNext = !guard.peeking && shelter.peek !== null && !pinned && atSpot(feetOf(guard), shelter)
    guard.peekSeconds = peekNext ? peekSeconds(world) : duckSeconds(world)
    guard.peeking = peekNext
    // Each time he goes back down he checks the spot still hides him (a table shot to bits, the shooter moved round).
    if (!peekNext && !shelterHolds(world, shelter, known)) guard.shelter = null
    // Hidden with no way to fire back from here: a few breaths, then he goes round or moves up by his role instead.
    else if (shelter.peek === null && atSpot(feetOf(guard), shelter) && (shelter.waits += 1) >= NO_PEEK_WAITS) shelter.spent = true
  }
  const goal = guard.peeking && shelter.peek ? shelter.peek : shelter
  const status = goTo(world, guard, goal, PATROL.runSpeed, dt, false)
  guard.crouching = status !== 'moving' && !guard.peeking && shelter.crouch
  return true
}

function leaveShelter(guard: Guard): false {
  guard.shelter = null
  guard.peeking = false
  return false
}

/** Down behind the shelter right now: no aimed shots from here. */
export function ducked(guard: Guard): boolean {
  return guard.shelter !== null && guard.shelter.hidden && !guard.peeking
}

function atSpot(feet: Vec, spot: Vec): boolean {
  return sameFloor(feet, spot) && Math.abs(feet.x - spot.x) < ARRIVED
}

function duckSeconds(world: World): number {
  return SHELTER.duckMin + world.rng() * (SHELTER.duckMax - SHELTER.duckMin)
}

function peekSeconds(world: World): number {
  return SHELTER.peekMin + world.rng() * (SHELTER.peekMax - SHELTER.peekMin)
}
