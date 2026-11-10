import { fireCells, smokeBetween, throwGrenade } from '../hazards/hazards'
import { emitNoise } from '../noise'
import { fireShot } from '../projectiles'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import { distance, type Vec } from '../types'
import { normalize } from '../vision'
import type { World } from '../world'
import { barkLine } from './barks'
import { findCover } from './coverSpots'
import { eyeOf, feetOf, setMode, type Guard, type SearchPlan } from './model'
import { goTo, hold } from './movement'
import { startSearch } from './orders'
import { floorBelow, landingsOnFloor, sameFloor } from './places'
import { COMBAT, PATROL, TIMING } from './tuning'

/**
 * Fighting as a trained team. Each guard plays the role the squad gave him (squad.ts): assault guards
 * take cover at a working distance and fire, the suppressor keeps the player's head down while they move,
 * a flanker goes round by another floor, the rest hold the nearest choke point, and the badly hurt fall back.
 * Nobody fires through a colleague, the first shot waits for the "Contact!" bark, and heavies flush a
 * player who has stayed put with a telegraphed flashbang. All of it works from the last known position.
 */

const SHOT = { speed: 24, damage: 12, tileDamage: 6, spread: 0.07, push: 0 }
const SHOT_NOISE = 28
const WILD_FIRE_PER_SECOND = 0.6
const CHOKE_SCAN = 15
const FLANK_BEYOND = 5
const FLANK_SECONDS = 30
const ESCAPE_DISTANCE = 4

/** Starts (or refreshes) a fight with the player at a position the guard has just seen. */
export function enterCombat(world: World, guard: Guard, at: Vec): void {
  guard.lastKnown = { ...at }
  guard.lastKnownAt = world.clock
  guard.awareness = 1
  if (guard.mode === 'combat') return
  setMode(guard, 'combat')
  guard.drawSeconds = TIMING.drawSeconds
  guard.alertSeconds = 0
  guard.lostSeconds = 0
  guard.cover = null
  guard.search = null
  guard.follow = null
  guard.interest = null
  guard.station = null
  guard.replan = 0
}

export function combatBehaviour(world: World, guard: Guard, dt: number): void {
  guard.alertSeconds += dt
  guard.drawSeconds -= dt
  guard.shootCooldown -= dt
  guard.flashCooldown -= dt
  guard.replan -= dt
  guard.lostSeconds = guard.seesPlayer ? 0 : guard.lostSeconds + dt
  const known = guard.lastKnown
  if (!known || guard.lostSeconds > TIMING.lostContact) {
    barkLine(world, guard, 'lost', true)
    startSearch(world, guard, known ? floorBelow(world, known) : feetOf(guard))
    hold(world, guard, dt)
    return
  }
  guard.target = known
  if (guard.pendingReport && !guard.seesPlayer) {
    setMode(guard, 'toAlarm')
    hold(world, guard, dt)
    return
  }
  if (guard.blindSeconds > 0) {
    staggerBlind(world, guard, dt)
    return
  }
  if (escapeHazard(world, guard, dt)) return
  guard.facing = known.x >= feetOf(guard).x ? 1 : -1
  if (guard.flashWindup > 0) {
    guard.flashWindup -= dt
    hold(world, guard, dt)
    if (guard.flashWindup <= 0) throwFlash(world, guard)
    return
  }
  if (mayThrowFlash(world, guard)) {
    guard.flashWindup = COMBAT.flashWindup
    barkLine(world, guard, 'flashOut', true)
    hold(world, guard, dt)
    return
  }
  if (guard.seesPlayer && world.player.stairs) barkLine(world, guard, 'stairs')
  moveForRole(world, guard, known, dt)
  guard.facing = known.x >= feetOf(guard).x ? 1 : -1
  tryFire(world, guard, known)
}

function moveForRole(world: World, guard: Guard, known: Vec, dt: number): void {
  const feet = feetOf(guard)
  const threat = floorBelow(world, known)
  const taken = world.guards.filter((other) => other !== guard && other.cover).map((other) => other.cover!)
  switch (guard.combatRole) {
    case 'fallback': {
      guard.cover ??= findCover(world, feet, threat, COMBAT.coverSearch * 1.5, true, taken) ?? { x: feet.x + Math.sign(feet.x - threat.x || 1) * 6, y: feet.y, high: false }
      takeCover(world, guard, guard.cover, dt)
      return
    }
    case 'assault': {
      if (!sameFloor(feet, threat)) {
        goTo(world, guard, threat, PATROL.runSpeed, dt, false)
        return
      }
      if (guard.cover && Math.sign(threat.x - guard.cover.x) !== Math.sign(threat.x - feet.x)) guard.cover = null
      guard.cover ??= findCover(world, feet, threat, COMBAT.coverSearch, false, taken)
      if (guard.cover) {
        takeCover(world, guard, guard.cover, dt)
        return
      }
      const gap = Math.abs(threat.x - feet.x)
      if (!guard.seesPlayer) goTo(world, guard, threat, PATROL.runSpeed, dt, false)
      else if (gap > COMBAT.keepDistance) goTo(world, guard, { x: threat.x - Math.sign(threat.x - feet.x) * COMBAT.keepDistance, y: feet.y }, PATROL.hurrySpeed, dt, false)
      else hold(world, guard, dt)
      return
    }
    case 'suppress':
      hold(world, guard, dt)
      return
    case 'flank': {
      guard.search ??= flankPlan(world, feet, threat)
      const point = guard.search.points[guard.search.index]
      if (!point) {
        goTo(world, guard, threat, PATROL.runSpeed, dt, false)
        return
      }
      if (goTo(world, guard, point, PATROL.runSpeed, dt, false) !== 'moving') guard.search.index += 1
      return
    }
    case 'hold': {
      guard.cover ??= { ...chokepoint(world, feet, threat), high: false }
      takeCover(world, guard, guard.cover, dt)
      return
    }
  }
}

function takeCover(world: World, guard: Guard, spot: Vec & { high: boolean }, dt: number): void {
  const status = goTo(world, guard, spot, PATROL.runSpeed, dt, false)
  guard.crouching = status === 'arrived' && !spot.high && guard.shootCooldown > 0.2
}

/** Aimed fire for token holders, slower wild fire for the suppressor, never through a colleague. */
function tryFire(world: World, guard: Guard, known: Vec): void {
  if (guard.drawSeconds > 0 || !guard.seesPlayer || guard.shootCooldown > 0 || guard.radio) return
  const aimed = world.security.shooters.includes(world.guards.indexOf(guard))
  if (!aimed && guard.combatRole !== 'suppress') return
  const eye = eyeOf(guard)
  if (colleagueInLine(world, guard, eye, known)) {
    guard.shootCooldown = 0.3
    return
  }
  shoot(world, guard, known, aimed ? SHOT.spread : COMBAT.suppressSpread)
  guard.shootCooldown = aimed ? COMBAT.aimedCooldownMin + world.rng() * (COMBAT.aimedCooldownMax - COMBAT.aimedCooldownMin) : COMBAT.suppressCooldown
}

function shoot(world: World, guard: Guard, at: Vec, spread: number): void {
  const eye = eyeOf(guard)
  fireShot(world, eye, normalize(at.x - eye.x, at.y - eye.y), { kind: 'bullet', fromPlayer: false, ...SHOT, spread })
  emitNoise(world, eye, SHOT_NOISE, 'guard')
  playSound(world, 'guardShot', eye)
  guard.kick = 0.7
  guard.crouching = false
}

/** Does the line of fire pass through another living guard? */
export function colleagueInLine(world: World, shooter: Guard, from: Vec, to: Vec): boolean {
  const minX = Math.min(from.x, to.x) - 0.2
  const maxX = Math.max(from.x, to.x) + 0.2
  const minY = Math.min(from.y, to.y) - 0.2
  const maxY = Math.max(from.y, to.y) + 0.2
  return world.guards.some((other) => {
    if (other === shooter || other.mode === 'dead') return false
    if (other.x > maxX || other.x + other.w < minX || other.y > maxY || other.y + other.h < minY) return false
    return segmentHitsBox(from, to, { x: other.x - 0.1, y: other.y - 0.1, w: other.w + 0.2, h: other.h + 0.2 })
  })
}

function segmentHitsBox(from: Vec, to: Vec, box: { x: number; y: number; w: number; h: number }): boolean {
  let enter = 0
  let exit = 1
  const delta = { x: to.x - from.x, y: to.y - from.y }
  for (const [start, step, low, high] of [[from.x, delta.x, box.x, box.x + box.w], [from.y, delta.y, box.y, box.y + box.h]] as const) {
    if (Math.abs(step) < 1e-9) {
      if (start < low || start > high) return false
      continue
    }
    const a = (low - start) / step
    const b = (high - start) / step
    enter = Math.max(enter, Math.min(a, b))
    exit = Math.min(exit, Math.max(a, b))
    if (enter > exit) return false
  }
  return true
}

/** Flashed: covers his eyes and staggers, now and then firing blind down the line he was facing. */
function staggerBlind(world: World, guard: Guard, dt: number): void {
  hold(world, guard, dt)
  guard.vx += (world.rng() - 0.5) * 2
  if (guard.drawSeconds > 0 || world.rng() > WILD_FIRE_PER_SECOND * dt) return
  const eye = eyeOf(guard)
  const at = { x: eye.x + guard.facing * 8, y: eye.y + (world.rng() - 0.5) * 4 }
  if (!colleagueInLine(world, guard, eye, at)) shoot(world, guard, at, 0.3)
}

/** Smoke or fire right on a guard: he coughs or shouts and gets out of it, away from the threat if he has one. */
export function escapeHazard(world: World, guard: Guard, dt: number): boolean {
  const feet = feetOf(guard)
  const eye = eyeOf(guard)
  const fire = fireCells(world).find((cell) => Math.abs(cell.x + 0.5 - feet.x) < 1.6 && Math.abs(cell.y + 0.5 - (feet.y - 0.8)) < 1.6)
  const smoky = !fire && smokeBetween(world, eye, { x: eye.x, y: feet.y - 0.1 }) > 0.4
  if (!fire && !smoky) return false
  barkLine(world, guard, fire ? 'fire' : 'cough')
  const away = fire ? Math.sign(feet.x - (fire.x + 0.5)) : guard.lastKnown ? Math.sign(feet.x - guard.lastKnown.x) : -guard.facing
  goTo(world, guard, { x: feet.x + (away || 1) * ESCAPE_DISTANCE, y: feet.y }, PATROL.runSpeed, dt, false)
  return true
}

function mayThrowFlash(world: World, guard: Guard): boolean {
  const spot = world.security.campSpot
  return guard.armored && guard.flashCooldown <= 0 && guard.drawSeconds <= 0 && !guard.radio && spot !== null
    && world.security.campSeconds >= COMBAT.campSeconds && distance(eyeOf(guard), spot) <= COMBAT.flashRange
}

function throwFlash(world: World, guard: Guard): void {
  const target = world.security.campSpot ?? guard.lastKnown
  if (!target) return
  const eye = eyeOf(guard)
  const dx = target.x - eye.x
  throwGrenade(world, 'flash', eye, normalize(dx, target.y - eye.y - Math.abs(dx) * 0.35))
  world.security.campSeconds = 0
  for (const other of world.guards) if (other.armored && other.mode === 'combat') other.flashCooldown = Math.max(other.flashCooldown, COMBAT.flashCooldown / 2)
  guard.flashCooldown = COMBAT.flashCooldown
}

/**
 * Where to wait for the player instead of rushing him: the near side of the first doorway toward him,
 * or the stair landing on this floor when he is on another one.
 */
function chokepoint(world: World, feet: Vec, threat: Vec): Vec {
  if (!sameFloor(feet, threat)) {
    const landing = landingsOnFloor(world, feet.y).sort((a, b) => Math.abs(a.x - feet.x) - Math.abs(b.x - feet.x))[0]
    return landing ? { x: landing.x + (feet.x > landing.x ? 1.5 : -1.5), y: landing.y } : feet
  }
  const side = Math.sign(threat.x - feet.x) || 1
  for (let step = 1; step <= CHOKE_SCAN && step < Math.abs(threat.x - feet.x) - 2; step += 1) {
    const column = Math.floor(feet.x + side * step) + 0.5
    const lintel = isSolidAt(world.grid, column, feet.y - 3.5)
    const open = !isSolidAt(world.grid, column, feet.y - 1.5) && !isSolidAt(world.grid, column, feet.y - 2.5)
    const thinWall = !isSolidAt(world.grid, column - 1, feet.y - 3.5) && !isSolidAt(world.grid, column + 1, feet.y - 3.5)
    if (lintel && open && thinWall) return { x: column - side * 1.5, y: feet.y }
  }
  return feet
}

/** Round by the floor above or below, coming back down beyond the player. */
function flankPlan(world: World, feet: Vec, threat: Vec): SearchPlan {
  const side = Math.sign(threat.x - feet.x) || 1
  const points: Vec[] = []
  const well = world.stairwells.find((candidate) => candidate.stops.some((y) => Math.abs(y - feet.y) < 0.5))
  if (well) {
    const stop = well.stops.findIndex((y) => Math.abs(y - feet.y) < 0.5)
    const other = well.stops[stop + 1] ?? well.stops[stop - 1]
    if (other !== undefined) points.push({ x: threat.x + side * FLANK_BEYOND, y: other })
  }
  points.push({ x: threat.x + side * 3, y: threat.y })
  return { points, index: 0, dwell: 0, endsAt: world.clock + FLANK_SECONDS }
}
