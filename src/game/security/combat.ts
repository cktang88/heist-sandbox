import { throwGrenade } from '../hazards/hazards'
import { emitNoise } from '../noise'
import { fireShot } from '../projectiles'
import { playSound } from '../sounds'
import { distance, type Vec } from '../types'
import { normalize } from '../vision'
import type { World } from '../world'
import { barkLine } from './barks'
import { startRadio } from './comms'
import { findCover } from './coverSpots'
import { escapeHazard } from './danger'
import { eyeOf, feetOf, magazineOf, setMode, type CombatRole, type Guard, type SearchPlan } from './model'
import { goTo, hold } from './movement'
import { companyOf, isShaken } from './nerve'
import { startSearch } from './orders'
import { floorBelow, isDoorway, landingsOnFloor, sameFloor } from './places'
import { clearOfDoorway, dragWounded } from './selfPreservation'
import { COMBAT, PATROL, TIERS, TIMING, UNDER_FIRE } from './tuning'

/**
 * Fighting as a trained team. Each guard plays the role the squad gave him (squad.ts): assault guards
 * take cover at a working distance and fire, the suppressor keeps the player's head down while they move,
 * a flanker goes round by another floor, the rest hold the nearest choke point, and the badly hurt fall back.
 * Nobody fires through a colleague, the first shot waits for the "Contact!" bark, and heavies flush a
 * player who has stayed put with a telegraphed flashbang. All of it works from the last known position.
 * They also behave like people who want to live: they reload behind cover, duck when rounds crack past,
 * move one at a time while a partner covers, fire blind from cover when too shaken to look, call for
 * backup when pinned or alone, haul wounded colleagues back, and hold fire when the player has a human shield.
 */

const SHOT = { speed: 24, damage: 12, tileDamage: 6, spread: 0.07, push: 0 }
const SHOT_NOISE = 28
const WILD_FIRE_PER_SECOND = 0.6
const CHOKE_SCAN = 15
const FLANK_BEYOND = 5
const FLANK_SECONDS = 30
/** Line-of-fire checks start this far out from the muzzle. */
const SHOULDER = 0.6
/** Share of standing height a kneeling guard takes up. */
const KNEELING_HEIGHT = 0.45
/** A partner moving this close makes him wait and cover rather than move at the same time. */
const BOUND_REACH = 8
/** Nobody waits on a partner who has been "moving" longer than this: he is stuck, not bounding. */
const BOUND_PATIENCE = 3
/** Blind fire is not wasted on a last known position this far away. */
const BLIND_REACH = 25

/** Starts (or refreshes) a fight with the player at a position the guard has just seen. */
export function enterCombat(world: World, guard: Guard, at: Vec): void {
  guard.lastKnown = { ...at }
  guard.lastKnownAt = world.clock
  guard.awareness = 1
  // A guard who has run or given up does not come back to the fight just because he sees the man.
  if (guard.mode === 'combat' || guard.mode === 'panic' || guard.mode === 'surrendered') return
  setMode(guard, 'combat')
  guard.drawSeconds = TIMING.drawSeconds * TIERS[guard.tier].draw
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
    blindBehaviour(world, guard, dt)
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
  guard.blindFiring = false
  if (guard.reloadSeconds > 0) {
    reloadInCover(world, guard, known, dt)
    return
  }
  const alone = companyOf(world, guard, UNDER_FIRE.aloneReach).colleagues === 0
  const pinned = guard.suppression > UNDER_FIRE.duckAbove
  askForBackup(world, guard, alone, pinned)
  if (!world.security.shooters.includes(world.guards.indexOf(guard)) && dragWounded(world, guard, known, dt)) return
  if (pinned) keepHeadDown(world, guard, known, dt)
  else {
    if (guard.seesPlayer && world.player.stairs) barkLine(world, guard, 'stairs')
    // Shaken and on his own, he does not push forward: he holds and waits for help.
    const role = guard.combatRole === 'assault' && alone && isShaken(guard) ? 'hold' : guard.combatRole
    moveForRole(world, guard, known, role, dt)
  }
  guard.facing = known.x >= feetOf(guard).x ? 1 : -1
  if (isShielded(world, guard)) {
    if (guard.seesPlayer) barkLine(world, guard, 'holdFire')
    return
  }
  if (mayBlindFire(guard, pinned)) blindFire(world, guard, known)
  else if (!pinned) tryFire(world, guard, known)
}

/**
 * Whether the player is holding a hostage in this guard's line of fire. Nobody can do that yet, so never;
 * the grab system answers this once it exists.
 */
export function isShielded(_world: World, _guard: Guard): boolean {
  return false
}

/** Pinned: down behind his cover, or crouched where he is, and he says so. */
function keepHeadDown(world: World, guard: Guard, known: Vec, dt: number): void {
  barkLine(world, guard, 'pinned')
  guard.cover ??= findCover(world, feetOf(guard), floorBelow(world, known), UNDER_FIRE.dragReach + 2, true, [])
  if (guard.cover) goTo(world, guard, guard.cover, PATROL.runSpeed, dt, false)
  else hold(world, guard, dt)
  guard.crouching = true
}

/** Out of rounds: back behind cover (or at least down) until the new magazine is in. */
function reloadInCover(world: World, guard: Guard, known: Vec, dt: number): void {
  guard.reloadSeconds = Math.max(0, guard.reloadSeconds - dt)
  if (guard.reloadSeconds === 0) guard.rounds = magazineOf(guard.armored)
  guard.cover ??= findCover(world, feetOf(guard), floorBelow(world, known), COMBAT.coverSearch / 2, true, [])
  if (guard.cover) goTo(world, guard, guard.cover, PATROL.runSpeed, dt, false)
  else hold(world, guard, dt)
  guard.crouching = true
}

/** Pinned, or shaken with nobody near: radio for help, not too often. */
function askForBackup(world: World, guard: Guard, alone: boolean, pinned: boolean): void {
  if (guard.radio || world.clock - guard.backupAt < UNDER_FIRE.backupEvery) return
  if (!pinned && !(alone && isShaken(guard))) return
  guard.backupAt = world.clock
  barkLine(world, guard, 'backup', true)
  startRadio(world, guard, { kind: 'backup', at: feetOf(guard), by: world.guards.indexOf(guard) })
}

/** Too shaken (or pinned) to look, with a fresh idea where the man is: fire round the cover at that spot. */
function mayBlindFire(guard: Guard, pinned: boolean): boolean {
  if (guard.drawSeconds > 0 || guard.shootCooldown > 0 || guard.radio || !guard.lastKnown) return false
  if (guard.lostSeconds > UNDER_FIRE.blindFreshSeconds) return false
  if (!pinned && (!isShaken(guard) || guard.seesPlayer)) return false
  return Math.abs(guard.lastKnown.x - feetOf(guard).x) < BLIND_REACH
}

/** Inaccurate fire at the last known position from low down, without looking: it pins the player and chips his cover. */
function blindFire(world: World, guard: Guard, known: Vec): void {
  const eye = eyeOf(guard)
  const aim = { x: known.x, y: known.y + (world.rng() - 0.5) * 1.2 }
  if (colleagueInLine(world, guard, eye, aim)) {
    guard.shootCooldown = 0.3
    return
  }
  if (!guard.blindFiring) barkLine(world, guard, 'blindFire')
  shoot(world, guard, aim, UNDER_FIRE.blindSpread)
  guard.blindFiring = true
  guard.crouching = true
  guard.shootCooldown = UNDER_FIRE.blindCooldownMin + world.rng() * (UNDER_FIRE.blindCooldownMax - UNDER_FIRE.blindCooldownMin)
}

function moveForRole(world: World, guard: Guard, known: Vec, role: CombatRole, dt: number): void {
  const feet = feetOf(guard)
  const threat = floorBelow(world, known)
  const taken = world.guards.filter((other) => other !== guard && other.cover).map((other) => other.cover!)
  const wasBounding = guard.bounding
  guard.bounding = false
  switch (role) {
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
      const side = Math.sign(threat.x - feet.x) || 1
      const spot = spaced(world, guard, { x: threat.x - side * COMBAT.keepDistance, y: feet.y }, side)
      const goal = guard.cover ?? (guard.seesPlayer ? spot : threat)
      const closing = guard.cover !== null || !guard.seesPlayer || Math.abs(threat.x - feet.x) > Math.abs(threat.x - spot.x) + 0.3
      const moving = closing && Math.abs(goal.x - feet.x) > 0.6
      if (moving && !bound(world, guard, wasBounding)) {
        hold(world, guard, dt)
        return
      }
      if (guard.cover) {
        takeCover(world, guard, guard.cover, dt)
        return
      }
      if (!guard.seesPlayer) {
        goTo(world, guard, threat, PATROL.runSpeed, dt, false)
        return
      }
      if (moving) goTo(world, guard, spot, PATROL.hurrySpeed, dt, false)
      else hold(world, guard, dt)
      // Kneel between shots so colleagues behind can fire over him.
      guard.crouching = guard.shootCooldown > 0.2
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
      guard.cover ??= clearOfDoorway(world, { ...spaced(world, guard, chokepoint(world, feet, threat), Math.sign(threat.x - feet.x) || 1), high: false }, threat)
      takeCover(world, guard, guard.cover, dt)
      return
    }
  }
}

/**
 * Covering and moving: when a partner close by is already on the move, he stays put and covers him; otherwise
 * he goes, and says so if someone is there to cover. Returns true if he may move now.
 */
function bound(world: World, guard: Guard, wasBounding: boolean): boolean {
  const feet = feetOf(guard)
  const near = (other: Guard) => other !== guard && other.mode === 'combat' && Math.abs(other.x - guard.x) < BOUND_REACH && sameFloor(feetOf(other), feet)
  const mover = world.guards.find((other) => near(other) && other.bounding && world.clock - other.boundSince < BOUND_PATIENCE
    && (!wasBounding || other.boundSince < guard.boundSince))
  if (mover) {
    if (wasBounding) barkLine(world, guard, 'covering')
    return false
  }
  if (!wasBounding) {
    guard.boundSince = world.clock
    if (world.guards.some(near)) barkLine(world, guard, 'moving')
  }
  guard.bounding = true
  return true
}

function takeCover(world: World, guard: Guard, spot: Vec & { high: boolean }, dt: number): void {
  const status = goTo(world, guard, spot, PATROL.runSpeed, dt, false)
  guard.crouching = status === 'arrived' && !spot.high && guard.shootCooldown > 0.2
}

/** Moves a spot back from the threat until no colleague is already standing on it, so two guards never share one place. */
function spaced(world: World, guard: Guard, spot: Vec, side: number): Vec {
  const result = { ...spot }
  for (let tries = 0; tries < 4; tries += 1) {
    const crowded = world.guards.some((other) => other !== guard && other.mode !== 'dead' && Math.abs(other.y + other.h - result.y) < 1 && Math.abs(other.x + other.w / 2 - result.x) < 0.9)
    if (!crowded) break
    result.x -= side * 1.2
  }
  return result
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
  const steadiness = TIERS[guard.tier].spread * (1 + guard.suppression * UNDER_FIRE.suppressionSpread)
  shoot(world, guard, known, (aimed ? SHOT.spread : COMBAT.suppressSpread) * steadiness)
  guard.shootCooldown = aimed ? COMBAT.aimedCooldownMin + world.rng() * (COMBAT.aimedCooldownMax - COMBAT.aimedCooldownMin) : COMBAT.suppressCooldown
}

function shoot(world: World, guard: Guard, at: Vec, spread: number): void {
  const eye = eyeOf(guard)
  fireShot(world, eye, normalize(at.x - eye.x, at.y - eye.y), { kind: 'bullet', fromPlayer: false, ...SHOT, spread })
  emitNoise(world, eye, SHOT_NOISE, 'guard')
  playSound(world, 'guardShot', eye)
  guard.kick = 0.7
  guard.crouching = false
  guard.rounds -= 1
  if (guard.rounds > 0) return
  guard.reloadSeconds = UNDER_FIRE.reloadSeconds
  barkLine(world, guard, 'reloading', true)
}

/**
 * Does the line of fire pass through another living guard? A kneeling colleague can be fired over,
 * and one shoulder to shoulder with the shooter is not in the way.
 */
export function colleagueInLine(world: World, shooter: Guard, eye: Vec, to: Vec): boolean {
  const reach = Math.hypot(to.x - eye.x, to.y - eye.y)
  if (reach < SHOULDER) return false
  const from = { x: eye.x + ((to.x - eye.x) / reach) * SHOULDER, y: eye.y + ((to.y - eye.y) / reach) * SHOULDER }
  const minX = Math.min(from.x, to.x) - 0.2
  const maxX = Math.max(from.x, to.x) + 0.2
  const minY = Math.min(from.y, to.y) - 0.2
  const maxY = Math.max(from.y, to.y) + 0.2
  return world.guards.some((other) => {
    if (other === shooter || other.mode === 'dead') return false
    if (other.x > maxX || other.x + other.w < minX || other.y > maxY || other.y + other.h < minY) return false
    const top = other.crouching ? other.y + other.h * (1 - KNEELING_HEIGHT) : other.y
    return segmentHitsBox(from, to, { x: other.x - 0.1, y: top - 0.1, w: other.w + 0.2, h: other.y + other.h - top + 0.2 })
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

/**
 * Flashed. How he copes depends on his nerve (chosen when the flash hit, see brain.ts): a steady fighter staggers
 * and now and then fires wild down the line he was facing, a shaken one stumbles about, a frightened one crouches
 * with his hands over his face.
 */
export function blindBehaviour(world: World, guard: Guard, dt: number): void {
  hold(world, guard, dt)
  if (guard.blindReaction === 'cover') {
    guard.crouching = true
    return
  }
  guard.crouching = false
  guard.vx += (world.rng() - 0.5) * (guard.blindReaction === 'stumble' ? 4 : 2)
  if (guard.blindReaction !== 'wild' || guard.drawSeconds > 0 || guard.reloadSeconds > 0 || world.rng() > WILD_FIRE_PER_SECOND * dt) return
  const eye = eyeOf(guard)
  const at = { x: eye.x + guard.facing * 8, y: eye.y + (world.rng() - 0.5) * 4 }
  if (!colleagueInLine(world, guard, eye, at)) shoot(world, guard, at, 0.3)
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
  throwGrenade(world, 'flash', eye, normalize(dx, target.y - eye.y - Math.abs(dx) * 0.35), 'guard')
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
    if (isDoorway(world, column, feet.y)) return { x: column - side * 1.5, y: feet.y }
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
