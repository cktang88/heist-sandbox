import { throwGrenade } from '../hazards/hazards'
import { emitNoise } from '../noise'
import { fireShot } from '../projectiles'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import { distance, type Vec } from '../types'
import { normalize } from '../vision'
import type { World } from '../world'
import { barkLine } from './barks'
import { startRadio } from './comms'
import { findCover } from './coverSpots'
import { escapeHazard } from './danger'
import { eyeOf, feetOf, magazineOf, setMode, type CombatRole, type Guard } from './model'
import { goTo, hold, type MoveStatus } from './movement'
import { companyOf, isShaken } from './nerve'
import { startSearch } from './orders'
import { floorBelow, isDoorway, landingsOnFloor, sameFloor } from './places'
import { clearOfDoorway, dragWounded } from './selfPreservation'
import { GUARD_PISTOL, GUARD_RIFLE, roundReaches } from './lineOfFire'
import { ducked, takeShelter } from './takingFire'
import { respectKillZones } from './killZones'
import { goBreach } from './blockedDoors'
import { moveInStack, stackBroken } from './shieldTeam'
import { COMBAT, PATROL, SHELTER, SHIELD, TIERS, TIMING, UNDER_FIRE } from './tuning'

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
/** Line-of-fire checks start this far out from the muzzle. */
const SHOULDER = 0.6
/** Share of standing height a kneeling guard takes up. */
const KNEELING_HEIGHT = 0.45
/** A partner moving this close makes him wait and cover rather than move at the same time. */
const BOUND_REACH = 8
/** Nobody waits on a partner who has been "moving" longer than this: he is stuck, not bounding. */
const BOUND_PATIENCE = 3
/** A man with more than this much air under him is hanging (rope, ledge) rather than standing. */
const HANGING_DROP = 3
/** How far in from a hanging man to look for the floor he is level with. */
const WINDOW_REACH = 10
/** A falling-back man pulls back at least this much further each time, and at most this far over open floor. */
const PULL_BACK_MIN = 2
const PULL_BACK_OPEN = 6
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
  if (guard.stackLeader !== null) followReports(world, guard)
  const known = guard.lastKnown
  // Hearing the man's gun keeps a fight going as surely as seeing him; a shield team pushes on the reports far longer.
  const heardLately = world.clock - guard.heardAt < TIMING.lostContact
  const patience = guard.stackLeader !== null ? SHIELD.patience : TIMING.lostContact
  if (!known || (guard.lostSeconds > patience && !heardLately)) {
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
  faceThreat(guard, known)
  if (guard.stackLeader !== null && !stackBroken(world, guard)) {
    moveInStack(world, guard, known, dt)
    if (guard.seesPlayer && !isShielded(world, guard)) tryFire(world, guard, known)
    return
  }
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
  if (!guard.seesPlayer && goBreach(world, guard, dt)) {
    // On his way to (or shooting through) a barricaded door he was called to.
  } else if (takeShelter(world, guard, known, dt)) {
    if (pinned) barkLine(world, guard, 'pinned')
  } else if (pinned) keepHeadDown(world, guard, known, dt)
  else {
    if (guard.seesPlayer && world.player.stairs) barkLine(world, guard, 'stairs')
    // Shaken and on his own, he does not push forward: he holds and waits for help. Holding a choke point the man never
    // comes through is no use either: after a while the holder moves up to find him, and at once when the man has dug in
    // somewhere (he is not on his way to the door, so there is nothing to wait for).
    const restless = guard.combatRole === 'hold' && !guard.seesPlayer && (guard.lostSeconds > COMBAT.holdPatience || dugIn(world))
    if (restless) moveUp(world, guard, known, dt)
    else moveForRole(world, guard, known, guard.combatRole === 'assault' && alone && isShaken(guard) ? 'hold' : guard.combatRole, dt)
  }
  faceThreat(guard, known)
  if (isShielded(world, guard)) {
    if (guard.seesPlayer) barkLine(world, guard, 'holdFire')
    return
  }
  if (mayBlindFire(guard, pinned)) blindFire(world, guard, known)
  else if (!pinned && !ducked(guard)) {
    if (guard.seesPlayer) tryFire(world, guard, known)
    else returnFire(world, guard, known)
  }
}

/** A shield team man without sight of the intruder goes on the control room's latest report of him. */
function followReports(world: World, guard: Guard): void {
  const report = world.security.lastKnown
  if (guard.seesPlayer || !report || world.security.lastContactAt <= guard.lastKnownAt) return
  guard.lastKnown = { ...report }
  guard.lastKnownAt = world.security.lastContactAt
}

/** Turns to the threat and points the gun straight at it, up or down included. */
function faceThreat(guard: Guard, known: Vec): void {
  const eye = eyeOf(guard)
  if (Math.abs(known.x - eye.x) > 0.3) guard.facing = known.x > eye.x ? 1 : -1
  guard.aim = normalize(known.x - eye.x, known.y - eye.y)
}

/** Penetration of his gun: a rifle for the armoured, a pistol for the rest. */
function gunPower(guard: Guard): number {
  return guard.armored ? GUARD_RIFLE : GUARD_PISTOL
}

/**
 * He cannot see the man but has just heard him fire from there: shots back at the spot, if a round could get there
 * (through a hole in the floor, a window, a door his rifle punches through). It keeps the shooter's head down.
 */
function returnFire(world: World, guard: Guard, known: Vec): void {
  if (guard.drawSeconds > 0 || guard.shootCooldown > 0 || guard.radio) return
  if (world.clock - guard.heardAt > SHELTER.returnFireSeconds) return
  const eye = eyeOf(guard)
  if (distance(eye, known) > SHELTER.returnFireReach || !roundReaches(world, eye, known, gunPower(guard))) return
  if (colleagueInLine(world, guard, eye, known)) {
    guard.shootCooldown = 0.3
    return
  }
  shoot(world, guard, known, SHELTER.returnSpread * TIERS[guard.tier].spread * (1 + guard.suppression * UNDER_FIRE.suppressionSpread))
  guard.shootCooldown = SHELTER.returnCooldownMin + world.rng() * (SHELTER.returnCooldownMax - SHELTER.returnCooldownMin)
}

/** Is the player holding a colleague as a human shield between himself and this guard? */
export function isShielded(world: World, guard: Guard): boolean {
  const shield = world.melee.shield
  if (!shield || shield === guard || shield.mode === 'dead') return false
  const player = world.player.x + world.player.w / 2
  const side = Math.sign(feetOf(guard).x - player)
  return side !== 0 && Math.sign(shield.x + shield.w / 2 - player) === side && Math.abs(shield.y - world.player.y) < 1.5
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
  const threat = groundUnder(world, feet, known)
  const taken = world.guards.filter((other) => other !== guard && other.cover).map((other) => other.cover!)
  const wasBounding = guard.bounding
  guard.bounding = false
  // Nobody walks into the doorway or stair head where colleagues were just cut down (killZones.ts).
  const heading = (role === 'flank' ? guard.search?.points[guard.search.index] : undefined) ?? threat
  if (role !== 'fallback' && role !== 'stack' && respectKillZones(world, guard, heading, dt)) return
  switch (role) {
    case 'fallback': {
      guard.cover ??= findCover(world, feet, threat, COMBAT.coverSearch * 1.5, true, taken) ?? { x: feet.x + Math.sign(feet.x - threat.x || 1) * 6, y: feet.y, high: false }
      // Back in cover with the man out of sight, there is nothing for him to do there: he pulls further back out of the fight.
      if (takeCover(world, guard, guard.cover, dt) === 'arrived' && !guard.seesPlayer && guard.lostSeconds > COMBAT.coverPatience) {
        guard.cover = furtherBack(world, feet, threat, taken) ?? guard.cover
      }
      return
    }
    case 'assault': {
      // On another floor, or out of sight for a while from behind his cover: he moves to get eyes on the man again.
      if (!sameFloor(feet, threat) || (!guard.seesPlayer && guard.lostSeconds > COMBAT.coverPatience)) {
        guard.cover = null
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
      // The squad hands a flanker his route when it gives him the job (squad.ts, flank.ts).
      const point = guard.search && world.clock < guard.search.endsAt ? guard.search.points[guard.search.index] : undefined
      if (!point) {
        goTo(world, guard, threat, PATROL.runSpeed, dt, false)
        return
      }
      if (goTo(world, guard, point, PATROL.runSpeed, dt, false) !== 'moving') guard.search!.index += 1
      return
    }
    case 'stack':
      return
    case 'hold': {
      const choke = guard.cover ?? chokepoint(world, feet, threat)
      // Nothing between him and the man to hold: standing about is no use, so he moves up like the others.
      if (!choke) return moveForRole(world, guard, known, 'assault', dt)
      guard.cover ??= clearOfDoorway(world, { ...spaced(world, guard, choke, Math.sign(threat.x - feet.x) || 1), high: false }, threat)
      takeCover(world, guard, guard.cover, dt)
      return
    }
  }
}

/** The man has stayed put long enough that he is fighting from there, not moving through the building. */
function dugIn(world: World): boolean {
  return world.security.campSeconds >= COMBAT.campSeconds / 2
}

/** Off the spot he was holding and straight toward the man to get eyes on him, short of any doorway where men just died. */
function moveUp(world: World, guard: Guard, known: Vec, dt: number): void {
  const threat = groundUnder(world, feetOf(guard), known)
  if (respectKillZones(world, guard, threat, dt)) return
  guard.cover = null
  goTo(world, guard, threat, PATROL.runSpeed, dt, false)
}

/**
 * Where to go for a threat at `known`: the floor under it, except when the man is hanging in the air (on a rope outside a
 * window, say). Then it is the nearest floor beside him at his height, on the guard's side: the guard goes to the
 * window, not down the stairs to the street below.
 */
function groundUnder(world: World, feet: Vec, known: Vec): Vec {
  const below = floorBelow(world, known)
  if (below.y - known.y <= HANGING_DROP) return below
  const side = Math.sign(feet.x - known.x) || 1
  for (let step = 1; step <= WINDOW_REACH; step += 1) {
    const x = known.x + side * step
    for (let y = Math.floor(known.y); y <= known.y + HANGING_DROP; y += 1) {
      if (isSolidAt(world.grid, x, y) && !isSolidAt(world.grid, x, y - 1)) return { x, y }
    }
  }
  return below
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
    if (world.guards.some(near)) barkLine(world, guard, 'moving', true)
  }
  guard.bounding = true
  return true
}

function takeCover(world: World, guard: Guard, spot: Vec & { high: boolean }, dt: number): MoveStatus {
  const status = goTo(world, guard, spot, PATROL.runSpeed, dt, false)
  guard.crouching = status === 'arrived' && !spot.high && guard.shootCooldown > 0.2
  return status
}

/** Cover further from the threat than he is now, or failing that open floor a few steps further back; null at a dead end. */
function furtherBack(world: World, feet: Vec, threat: Vec, taken: readonly Vec[]): (Vec & { high: boolean }) | null {
  const gap = Math.abs(feet.x - threat.x)
  const cover = findCover(world, feet, threat, COMBAT.coverSearch * 1.5, true, taken)
  if (cover && Math.abs(cover.x - threat.x) > gap + PULL_BACK_MIN) return cover
  const away = Math.sign(feet.x - threat.x) || 1
  for (let step = 1; step <= PULL_BACK_OPEN; step += 1) {
    const x = feet.x + away * step
    if (isSolidAt(world.grid, x, feet.y - 0.5) || isSolidAt(world.grid, x, feet.y - 1.5) || !isSolidAt(world.grid, x, feet.y + 0.5)) {
      return step > PULL_BACK_MIN + 1 ? { x: x - away, y: feet.y, high: false } : null
    }
  }
  return { x: feet.x + away * PULL_BACK_OPEN, y: feet.y, high: false }
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

/**
 * A deliberate shot at a spot he cannot see (into a room below through a hole in the floor, through a door): only when
 * his gun is up, nobody is in the line, and at the slow aimed rate. Returns true if he fired.
 */
export function fireAt(world: World, guard: Guard, at: Vec): boolean {
  if (guard.drawSeconds > 0 || guard.shootCooldown > 0 || guard.radio || guard.reloadSeconds > 0) return false
  if (colleagueInLine(world, guard, eyeOf(guard), at)) {
    guard.shootCooldown = 0.3
    return false
  }
  shoot(world, guard, at, SHELTER.returnSpread * TIERS[guard.tier].spread)
  guard.shootCooldown = COMBAT.aimedCooldownMin + world.rng() * (COMBAT.aimedCooldownMax - COMBAT.aimedCooldownMin)
  return true
}

function shoot(world: World, guard: Guard, at: Vec, spread: number): void {
  const eye = eyeOf(guard)
  fireShot(world, eye, normalize(at.x - eye.x, at.y - eye.y), { kind: 'bullet', fromPlayer: false, ...SHOT, spread, penetration: gunPower(guard) })
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
    // A shield team fires past its own men's shoulders.
    if (shooter.stackLeader !== null && other.stackLeader === shooter.stackLeader) return false
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
 * or the stair landing on this floor when he is on another one. Null when there is nothing to hold.
 */
function chokepoint(world: World, feet: Vec, threat: Vec): Vec | null {
  if (!sameFloor(feet, threat)) {
    const landing = landingsOnFloor(world, feet.y).sort((a, b) => Math.abs(a.x - feet.x) - Math.abs(b.x - feet.x))[0]
    return landing ? { x: landing.x + (feet.x > landing.x ? 1.5 : -1.5), y: landing.y } : null
  }
  const side = Math.sign(threat.x - feet.x) || 1
  for (let step = 1; step <= CHOKE_SCAN && step < Math.abs(threat.x - feet.x) - 2; step += 1) {
    const column = Math.floor(feet.x + side * step) + 0.5
    if (isDoorway(world, column, feet.y)) return { x: column - side * 1.5, y: feet.y }
  }
  return null
}

