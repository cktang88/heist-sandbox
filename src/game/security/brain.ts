import { lightLevelAt } from '../light'
import { cutRopesNear } from '../rope/rope'
import { triggerSlowmo } from '../time'
import { centerOf, distance, type Vec } from '../types'
import type { Device, World } from '../world'
import { barkLine, type LineKind } from './barks'
import { pressAlarmButton } from '../devices/devices'
import { restoreCircuit } from '../devices/power'
import { blindBehaviour, combatBehaviour, enterCombat } from './combat'
import { alreadyCalling, progressRadio, shout, startRadio } from './comms'
import { escapeHazard, markFireReported, spotFire } from './danger'
import { lookForTrouble, smokeGrenadeNear } from './discoveries'
import { holdsBack, panicBehaviour, surrenderedBehaviour } from './fear'
import { noiseKind, type NoiseSource } from './hearing'
import { eyeOf, feetOf, isActive, setMode, type Guard, type GuardMode, type InterestKind } from './model'
import { goTo, hold } from './movement'
import { frighten, isBreaking, isShaken, onBlast, updateNerve } from './nerve'
import { startSearch } from './orders'
import { patrolBehaviour } from './patrol'
import { detectPlayer, isAlerted, spotBody } from './perception'
import { buildingAt, deviceFeet, floorBelow, sameFloor, travelCost } from './places'
import { beingDragged, stepDive, watchForGrenades } from './selfPreservation'
import { AWARENESS, COMMS, LOD, NERVE, PATROL, RESPONSE, TIERS, TIMING, VISION } from './tuning'

/**
 * One guard's mind, run every frame: keep his nerve up to date, look after his own skin (dive from a grenade,
 * go limp while a colleague drags him), perceive, keep any radio call going, act on the current mode, and say
 * out loud whatever just changed. Modes and what moves between them are described in model.ts.
 */

const EVIDENCE_EVERY = 0.3
const LOOK_FLIP = 1.3
const HURRIED: readonly InterestKind[] = ['gunfire', 'body', 'shout', 'order', 'fire']
/** Close enough to a fire to see what is burning, without walking into it. */
const FIRE_STANDOFF = 4
const OTHER_BUILDING = 200
/** Standing at a rope's knot, he can reach it to cut it. */
const ROPE_REACH = 2.5

export function thinkGuard(world: World, guard: Guard, dt: number): void {
  guard.modeSeconds += dt
  updateNerve(world, guard, dt)
  if (guard.diveSeconds > 0) return stepDive(world, guard, dt)
  if (guard.draggedBy !== null && beingDragged(world, guard, dt)) return
  if (guard.mode === 'surrendered') return surrenderedBehaviour(world, guard, dt)
  if ((world.hazards.grenades.length > 0 || world.frags.length > 0) && watchForGrenades(world, guard)) return
  if (reactToBlindness(world, guard, dt)) {
    announce(world, guard)
    return
  }
  perceive(world, guard, dt)
  progressRadio(world, guard, dt)
  if (guard.mode === 'combat') reportContact(world, guard)
  if (guard.radio && guard.mode !== 'combat') {
    // Calling it in, standing still, unless he is standing in fire or smoke.
    if (escapeHazard(world, guard, dt)) return announce(world, guard)
    faceInterest(guard)
    hold(world, guard, dt)
  } else {
    act(world, guard, dt)
  }
  announce(world, guard)
}

function act(world: World, guard: Guard, dt: number): void {
  // Fighting guards get out of fire and smoke as part of fighting (combat.ts); everyone else does it first.
  if (guard.mode !== 'combat' && escapeHazard(world, guard, dt)) return
  switch (guard.mode) {
    case 'calm':
    case 'caution':
      if (guard.mode === 'caution' && guard.modeSeconds > TIMING.cautionSeconds && world.security.level < 2) setMode(guard, 'calm')
      patrolBehaviour(world, guard, dt)
      return
    case 'noticed':
      noticed(world, guard, dt)
      return
    case 'investigating':
      investigating(world, guard, dt)
      return
    case 'searching':
      searching(world, guard, dt)
      return
    case 'combat':
      combatBehaviour(world, guard, dt)
      return
    case 'toAlarm':
      runToAlarm(world, guard, dt)
      return
    case 'panic':
      panicBehaviour(world, guard, dt)
      return
    case 'surrendered':
    case 'dead':
      return
  }
}

// --- Perception -------------------------------------------------------------------------------

/** Calm guards far from the player look less often; everyone else looks every frame. */
function thinkInterval(world: World, guard: Guard): number {
  if (guard.mode !== 'calm' && guard.mode !== 'caution') return 0
  const dx = Math.abs(guard.x - world.player.x)
  const dy = Math.abs(guard.y - world.player.y)
  if (dx < LOD.nearX && dy < LOD.nearY) return 0
  return dx < LOD.nearX * 2 && dy < LOD.nearY * 2 ? LOD.midThink : LOD.farThink
}

function perceive(world: World, guard: Guard, dt: number): void {
  guard.thinkTimer += dt
  if (guard.thinkTimer < thinkInterval(world, guard)) return
  const step = guard.thinkTimer
  guard.thinkTimer = 0

  const sight = detectPlayer(world, guard)
  guard.seesPlayer = sight !== null && (sight.zone === 'central' || guard.mode === 'combat')
  if (sight) {
    const primed = isAlerted(guard) || guard.mode === 'investigating' || guard.mode === 'caution' || world.security.level >= 2
    const cap = sight.zone === 'central' || guard.mode === 'combat' ? 1 : AWARENESS.peripheralCap
    if (guard.awareness < cap) guard.awareness = Math.min(cap, guard.awareness + sight.rate * step * (primed ? 1.5 : 1))
    const seen = centerOf(world.player)
    if (guard.awareness >= 1) {
      if (guard.mode !== 'combat') {
        world.stats.timesSpotted += 1
        triggerSlowmo(world.time, 0.7, 0.25)
      }
      enterCombat(world, guard, seen)
    } else if (guard.awareness >= AWARENESS.noticeAt) {
      noticeSomething(guard, floorBelow(world, seen), 'glimpse', 3)
    }
  } else if (guard.mode !== 'combat') {
    guard.awareness = Math.max(0, guard.awareness - AWARENESS.decay * step)
  }

  guard.evidenceTimer -= step
  if (guard.evidenceTimer > 0 || guard.mode === 'combat' || guard.mode === 'panic') return
  guard.evidenceTimer = EVIDENCE_EVERY
  const fire = guard.interest?.kind === 'fire' ? null : spotFire(world, guard)
  if (fire) noticeSomething(guard, floorBelow(world, fire), 'fire', 5)
  noticeTrouble(world, guard)
  const body = spotBody(world, guard)
  if (body === null) return
  guard.bodiesSeen.push(body)
  frighten(guard, NERVE.body)
  if (world.security.reportedBodies.has(body) || guard.interest?.kind === 'body') return
  const hip = world.guards[body].ragdoll!.points[2]
  guard.interest = { at: floorBelow(world, hip), kind: 'body', priority: 5, reached: false, body }
  setMode(guard, 'investigating')
  shout(world, guard, { kind: 'body', at: { x: hip.x, y: hip.y }, by: world.guards.indexOf(guard) })
}

/** Something out of place (an open door, smoke, the empty vault, a parachute): stop, say it, and radio it if it matters. */
function noticeTrouble(world: World, guard: Guard): void {
  if (!wouldNotice(guard, 1)) return
  const found = lookForTrouble(world, guard)
  if (!found || !wouldNotice(guard, found.priority)) return
  noticeSomething(guard, found.at, found.kind, found.priority)
  if (guard.interest) guard.interest.tamper = found.tamper
  barkLine(world, guard, found.line, true)
  // That was his line for it: no second "Huh?" for the same thing.
  guard.announced = guard.mode
  if (found.report && !alreadyCalling(world, found.report.kind, found.at)) startRadio(world, guard, found.report)
}

/** Would a guard drop what he is doing for something of this priority? */
function wouldNotice(guard: Guard, priority: number): boolean {
  if (guard.mode === 'combat' || guard.mode === 'dead' || guard.mode === 'toAlarm' || guard.mode === 'panic' || guard.mode === 'surrendered') return false
  return !guard.interest || guard.interest.priority <= priority
}

/** Takes a new interest if it matters at least as much as the current one, and stops to look at it. */
function noticeSomething(guard: Guard, at: Vec, kind: InterestKind, priority: number): void {
  if (!wouldNotice(guard, priority)) return
  if (guard.interest && guard.interest.kind === kind && guard.mode !== 'calm' && guard.mode !== 'caution') {
    guard.interest.at = at
    return
  }
  guard.interest = { at, kind, priority, reached: false }
  guard.follow = null
  guard.partnerWait = 0
  setMode(guard, 'noticed')
}

/**
 * A bullet cracked past him. Someone is shooting at him: he knows roughly where from, and a guard who had
 * no idea turns to face it at once.
 */
export function shotAt(world: World, guard: Guard): void {
  if (guard.mode === 'combat' || guard.mode === 'panic') return
  guard.awareness = Math.max(guard.awareness, 0.8)
  noticeSomething(guard, floorBelow(world, centerOf(world.player)), 'gunfire', 6)
  if (guard.interest?.kind === 'gunfire') guard.modeSeconds = Math.max(guard.modeSeconds, TIMING.noticePause * 0.6)
}

/** Sends a calm guard to look at a spot (a noise, a distraction). Fighting and dead guards ignore it. */
export function investigate(guard: Guard, at: Vec): void {
  noticeSomething(guard, { x: at.x, y: at.y }, 'noise', 4)
}

/**
 * A sound reached this guard. Shots and blasts are solid evidence: he calls them in and goes to look.
 * Colleagues' own gunfire and doors only bring calm guards running to help.
 */
export function hearNoise(world: World, guard: Guard, at: Vec, radius: number, source: NoiseSource, what?: 'scrape'): void {
  if (guard.mode === 'surrendered') return
  const kind = noiseKind(radius)
  const blast = source === 'player' && radius >= RESPONSE.blastRadius
  if (blast) onBlast(guard, at)
  if (guard.mode === 'panic') return
  if (source === 'guard') {
    if (kind === 'loud' && (guard.mode === 'calm' || guard.mode === 'caution' || guard.mode === 'noticed')) {
      guard.interest = { at: { ...at }, kind: 'shout', priority: 5, reached: false }
      setMode(guard, 'investigating')
    }
    return
  }
  if (guard.mode === 'combat') {
    if (kind === 'loud' && !guard.seesPlayer) {
      guard.lastKnown = { ...at }
      guard.lastKnownAt = world.clock
    }
    return
  }
  if (kind !== 'loud') {
    if (seesThroughDistraction(world, guard, at)) return
    const priority = kind === 'faint' ? 2 : 4
    if (!answers(world, guard, at, 'noise', priority)) return
    noticeSomething(guard, { ...at }, 'noise', priority)
    if (what === 'scrape' && guard.interest?.kind === 'noise') barkLine(world, guard, 'scrape', true)
    return
  }
  guard.awareness = Math.max(guard.awareness, 0.5)
  if (answers(world, guard, at, blast ? 'blast' : 'gunfire', 6)) noticeSomething(guard, { ...at }, 'gunfire', 6)
  else if (guard.mode === 'calm') setMode(guard, 'caution')
  if (blast) {
    if (!alreadyCalling(world, 'explosion', at)) startRadio(world, guard, { kind: 'explosion', at: { ...at } })
    return
  }
  const fresh = world.clock - world.security.lastContactAt < COMMS.freshReport
  if (!fresh && !alreadyCalling(world, 'noise', at)) startRadio(world, guard, { kind: 'noise', at: { ...at }, loud: true })
}

/** A clatter well away from where the man must be (something thrown) is a known trick to a veteran who is already on edge. */
const THROWN_FROM = 5

function seesThroughDistraction(world: World, guard: Guard, at: Vec): boolean {
  const onEdge = guard.mode !== 'calm' || world.security.level >= 2
  if (guard.tier !== 'veteran' || !onEdge || distance(centerOf(world.player), at) < THROWN_FROM) return false
  barkLine(world, guard, 'trick')
  // He turns his back on the noise: the thrower is the other way.
  guard.facing = at.x >= guard.x + guard.w / 2 ? -1 : 1
  guard.awareness = Math.max(guard.awareness, AWARENESS.noticeAt)
  if (guard.mode === 'calm') setMode(guard, 'caution')
  return true
}

/**
 * Proportion: a small sound gets one guard, gunfire the few nearest who heard it, a blast a few more. Whoever
 * hears it after enough colleagues have already gone only turns to look. Returns true if this guard goes.
 */
function answers(world: World, guard: Guard, at: Vec, kind: 'noise' | 'gunfire' | 'blast', priority: number): boolean {
  if (!wouldNotice(guard, priority)) return false
  const current = guard.interest
  if (current && Math.abs(current.at.x - at.x) < RESPONSE.sameSpot && Math.abs(current.at.y - at.y) < 4) return true
  const responses = world.security.responses
  const near = responses.find((response) => response.kind === kind && world.clock - response.clock < RESPONSE.forgetSeconds
    && Math.abs(response.at.x - at.x) < RESPONSE.sameSpot && Math.abs(response.at.y - at.y) < 4)
  if (near && near.count >= RESPONSE[kind]) {
    guard.facing = at.x >= guard.x + guard.w / 2 ? 1 : -1
    guard.wait = Math.max(guard.wait, 1.5)
    return false
  }
  if (near) near.count += 1
  else responses.push({ at: { ...at }, kind, count: 1, clock: world.clock })
  return true
}

// --- Behaviours -------------------------------------------------------------------------------

function faceInterest(guard: Guard): void {
  const at = guard.interest?.at ?? guard.lastKnown
  if (at) guard.facing = at.x >= guard.x + guard.w / 2 ? 1 : -1
}

/** The grace period: stop, face it, let the meter fill or drain, then walk over. */
function noticed(world: World, guard: Guard, dt: number): void {
  if (!guard.interest) {
    standDown(world, guard)
    hold(world, guard, dt)
    return
  }
  faceInterest(guard)
  hold(world, guard, dt)
  if (guard.modeSeconds >= TIMING.noticePause) setMode(guard, 'investigating')
}

function investigating(world: World, guard: Guard, dt: number): void {
  const interest = guard.interest
  if (!interest) {
    standDown(world, guard)
    hold(world, guard, dt)
    return
  }
  const goal = floorBelow(world, interest.at)
  if (!interest.reached) {
    if (holdsBack(world, guard, goal, dt)) return
    const speed = HURRIED.includes(interest.kind) ? PATROL.hurrySpeed : PATROL.walkSpeed
    const status = goTo(world, guard, goal, speed, dt, false)
    const feet = feetOf(guard)
    const closeToBody = interest.kind === 'body' && sameFloor(feet, goal) && Math.abs(feet.x - goal.x) < 1.5
    const closeToFire = interest.kind === 'fire' && sameFloor(feet, goal) && Math.abs(feet.x - goal.x) < FIRE_STANDOFF
    if (status !== 'moving' || closeToBody || closeToFire || guard.modeSeconds > TIMING.investigateGiveUp) arrive(world, guard)
    return
  }
  hold(world, guard, dt)
  lookAround(guard, dt)
  if (guard.wait <= 0) conclude(world, guard, goal)
}

function arrive(world: World, guard: Guard): void {
  const interest = guard.interest!
  interest.reached = true
  guard.wait = TIMING.lookMin + world.rng() * (TIMING.lookMax - TIMING.lookMin)
  if (interest.kind === 'body' && interest.body !== undefined && !world.security.reportedBodies.has(interest.body)) {
    const hip = world.guards[interest.body].ragdoll?.points[2] ?? interest.at
    if (!alreadyCalling(world, 'body', hip)) startRadio(world, guard, { kind: 'body', at: { x: hip.x, y: hip.y }, by: world.guards.indexOf(guard) })
  }
  if (interest.kind === 'fire') {
    markFireReported(world, interest.at)
    if (!alreadyCalling(world, 'fire', interest.at)) startRadio(world, guard, { kind: 'fire', at: { ...interest.at }, alarm: false })
  }
  if (interest.kind === 'tamper' && interest.tamper === 'rope') {
    cutRopesNear(world, interest.at, ROPE_REACH)
    barkLine(world, guard, 'cutRope')
  }
  // At the fuse box (or light switch) of a dark room: throw it back on.
  if (interest.kind === 'lightsOut' && interest.circuit !== undefined && world.deadCircuits.has(interest.circuit)) {
    restoreCircuit(world, interest.circuit)
    barkLine(world, guard, 'lightsOn')
  }
}

function lookAround(guard: Guard, dt: number): void {
  const before = guard.wait
  guard.wait -= dt
  if (Math.floor(before / LOOK_FLIP) !== Math.floor(guard.wait / LOOK_FLIP)) guard.facing = guard.facing === 1 ? -1 : 1
}

/** What the guard makes of what he found. Solid evidence turns into a search; a noise with nothing there does not. */
function conclude(world: World, guard: Guard, at: Vec): void {
  const interest = guard.interest
  const kind = interest?.kind
  if (kind === 'body' || kind === 'gunfire' || kind === 'shout') startSearch(world, guard, at)
  else if (kind === 'order') startSearch(world, guard, at, TIMING.searchSeconds / 2)
  else if (kind === 'tamper') {
    startRadio(world, guard, { kind: 'tamper', at, what: interest?.tamper ?? 'door' })
    startSearch(world, guard, at, TIMING.searchSeconds / 2)
  } else if (kind === 'smoke' && smokeGrenadeNear(world, at)) {
    barkLine(world, guard, 'smokeGrenade', true)
    startRadio(world, guard, { kind: 'noise', at, loud: false })
    startSearch(world, guard, at, TIMING.searchSeconds / 2)
  }
  else if (guard.search && world.clock < guard.search.endsAt) {
    // A false lead in the middle of a search: carry on with the search.
    guard.interest = null
    setMode(guard, 'searching')
  } else {
    if (kind === 'lightsOut') startRadio(world, guard, { kind: 'fault', at, what: 'lights' })
    standDown(world, guard)
  }
}

function searching(world: World, guard: Guard, dt: number): void {
  if (guard.follow !== null) {
    if (followLeader(world, guard, dt)) return
    guard.follow = null
  }
  const plan = (guard.search ??= startPlanHere(world, guard))
  const point = plan.points[plan.index]
  if (world.clock > plan.endsAt || !point) {
    standDown(world, guard)
    hold(world, guard, dt)
    return
  }
  if (plan.dwell > 0) {
    const before = plan.dwell
    plan.dwell -= dt
    if (Math.floor(before / LOOK_FLIP) !== Math.floor(plan.dwell / LOOK_FLIP)) guard.facing = guard.facing === 1 ? -1 : 1
    hold(world, guard, dt)
    if (plan.dwell <= 0) plan.index += 1
    return
  }
  if (goTo(world, guard, point, PATROL.hurrySpeed * 0.85, dt, false) !== 'moving') plan.dwell = TIMING.searchDwell * TIERS[guard.tier].search
}

function startPlanHere(world: World, guard: Guard): NonNullable<Guard['search']> {
  startSearch(world, guard, guard.lastKnown ? floorBelow(world, guard.lastKnown) : feetOf(guard))
  return guard.search!
}

/** A follower stays a step and a half behind his leader, facing the other way to cover his back. */
function followLeader(world: World, guard: Guard, dt: number): boolean {
  const leader = world.guards[guard.follow!]
  if (!leader || !isActive(leader) || leader.follow !== null || (leader.mode !== 'investigating' && leader.mode !== 'searching')) return false
  const lead = feetOf(leader)
  const spot = { x: lead.x - leader.facing * 1.5, y: lead.y }
  const feet = feetOf(guard)
  if (sameFloor(feet, spot) && Math.abs(feet.x - spot.x) < 0.8) {
    hold(world, guard, dt)
    guard.facing = leader.facing === 1 ? -1 : 1
  } else {
    goTo(world, guard, spot, PATROL.hurrySpeed, dt, false)
  }
  return true
}

/**
 * The radio is dead: run to the nearest working alarm button and press it, telling the control room where
 * the intruder was. If the player disables the button first, the guard goes on to the next one.
 */
function runToAlarm(world: World, guard: Guard, dt: number): void {
  const button = nearestAlarmButton(world, feetOf(guard))
  const report = guard.pendingReport
  const lead = report && 'at' in report ? report.at : guard.lastKnown
  if (!button) {
    guard.pendingReport = null
    startSearch(world, guard, lead ? floorBelow(world, lead) : feetOf(guard))
    hold(world, guard, dt)
    return
  }
  guard.target = deviceFeet(world, button)
  if (goTo(world, guard, guard.target, PATROL.runSpeed, dt, false) !== 'arrived') return
  if (!pressAlarmButton(world, button, lead ?? undefined)) return
  barkLine(world, guard, 'alarmPressed', true)
  guard.pendingReport = null
  startSearch(world, guard, lead ? floorBelow(world, lead) : feetOf(guard))
}

function nearestAlarmButton(world: World, feet: Vec): Device | null {
  const building = buildingAt(world, feet)
  let best: Device | null = null
  let bestCost = Infinity
  for (const device of world.devices) {
    if (device.kind !== 'alarmButton' || device.disabled) continue
    const spot = deviceFeet(world, device)
    const cost = travelCost(feet, spot) + (buildingAt(world, spot) === building ? 0 : OTHER_BUILDING)
    if (cost < bestCost) {
      best = device
      bestCost = cost
    }
  }
  return best
}

/** Back to the post or route; still on edge if the site is. */
export function standDown(world: World, guard: Guard): void {
  guard.interest = null
  guard.search = null
  guard.follow = null
  guard.partnerWait = 0
  guard.hesitatedRoom = null
  setMode(guard, world.security.level >= 1 ? 'caution' : 'calm')
}

/** A fighting guard who can see the player keeps the control room's picture fresh. */
function reportContact(world: World, guard: Guard): void {
  if (!guard.seesPlayer || guard.radio || !guard.lastKnown) return
  if (world.clock - world.security.lastContactAt < COMMS.freshReport || alreadyCalling(world, 'sighting', guard.lastKnown)) return
  startRadio(world, guard, { kind: 'sighting', at: { ...guard.lastKnown }, by: world.guards.indexOf(guard) })
}

/**
 * Flashed: no sight, no radio. A steady fighter fires wild, a shaken guard stumbles about shouting, a frightened
 * one covers his face (see blindBehaviour). Afterwards he knows something is wrong.
 */
function reactToBlindness(world: World, guard: Guard, dt: number): boolean {
  if (guard.blindSeconds <= 0) {
    if (guard.wasBlind) {
      guard.wasBlind = false
      guard.blindReaction = null
      if (guard.mode !== 'combat') noticeSomething(guard, feetOf(guard), 'gunfire', 6)
    }
    return false
  }
  if (!guard.wasBlind) {
    guard.wasBlind = true
    guard.radio = null
    frighten(guard, NERVE.flashed)
    guard.blindReaction = isBreaking(guard) ? 'cover' : guard.mode === 'combat' && !isShaken(guard) ? 'wild' : 'stumble'
    barkLine(world, guard, guard.blindReaction === 'cover' ? 'flashCover' : guard.blindReaction === 'wild' ? 'flashWild' : 'flashed', true)
  }
  guard.seesPlayer = false
  if (guard.mode === 'combat') combatBehaviour(world, guard, dt)
  else blindBehaviour(world, guard, dt)
  return true
}

// --- Saying it out loud -------------------------------------------------------------------------

/** Every mode change is announced once, so the player always hears why a guard is doing what he does. */
function announce(world: World, guard: Guard): void {
  const from = guard.announced
  const to = guard.mode
  if (from === to) return
  guard.announced = to
  const dark = to === 'investigating' && lightLevelAt(world, eyeOf(guard)) < VISION.dim
  const line = dark && guard.interest?.kind !== 'body' ? 'dark' : lineFor(guard, from, to)
  if (line) barkLine(world, guard, line, to === 'combat' || to === 'noticed')
  if (to === 'combat' && guard.lastKnown) shout(world, guard, { kind: 'sighting', at: { ...guard.lastKnown }, by: world.guards.indexOf(guard) })
}

function lineFor(guard: Guard, from: GuardMode, to: GuardMode): LineKind | null {
  const kind = guard.interest?.kind
  switch (to) {
    case 'noticed':
      return kind === 'lightsOut' ? 'lightsOut' : kind === 'gunfire' ? 'gunfire' : kind === 'fire' ? 'seeFire' : 'huh'
    case 'investigating':
      return kind === 'body' ? 'manDown' : kind === 'order' ? null : 'checking'
    case 'searching':
      return guard.follow !== null || from === 'combat' ? null : 'searching'
    case 'combat':
      return 'contact'
    case 'calm':
    case 'caution':
      return from === 'searching' ? 'allClear' : from === 'noticed' || from === 'investigating' ? 'nothing' : null
    default:
      return null
  }
}

