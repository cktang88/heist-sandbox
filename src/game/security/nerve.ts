import { nearestFire } from '../hazards/hazards'
import { lightLevelAt } from '../light'
import type { Projectile } from '../projectiles'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { barkLine, nameOf } from './barks'
import { shelteredFrom } from './coverSpots'
import { breakDown, pullTogether } from './fear'
import { eyeOf, feetOf, isActive, type Guard } from './model'
import { clearView } from './perception'
import { roomOf } from './places'
import { NERVE, TIERS, UNDER_FIRE, VISION } from './tuning'

/**
 * Nerve: how steady a guard is, from 0 (broken) to 1. It is the base his experience gives him, plus what his
 * situation gives or takes (company, an officer, cover; being alone, in the dark, near fire, wounded, pinned),
 * minus the fright (`shock`) left by what has happened to him, which fades slowly. Events add fright the moment
 * they happen; the situation is re-read a few times a second, and not at all for a calm guard with nothing on his mind.
 * What low nerve does is decided where the behaviour lives (fear.ts, combat.ts, brain.ts); this file only keeps the number.
 */

const CLOSE_FLOOR = 3
const WITNESS_SIGHT = 16
const WITNESS_HEARD = 6

export function isShaken(guard: Guard): boolean {
  return guard.nerve < NERVE.shaken
}

export function isBreaking(guard: Guard): boolean {
  return guard.nerve < NERVE.breaking
}

/** Adds fright from something that just happened. The nerve drops at once, not at the next re-read. */
export function frighten(guard: Guard, amount: number): void {
  if (guard.mode === 'dead' || amount <= 0) return
  guard.shock = Math.min(1, guard.shock + amount)
  guard.nerve = Math.max(0, guard.nerve - amount)
}

/** Every frame: suppression fades; a few times a second, the nerve is re-read and acted on. */
export function updateNerve(world: World, guard: Guard, dt: number): void {
  guard.suppression = Math.max(0, guard.suppression - UNDER_FIRE.suppressionFade * dt)
  guard.nerveTimer += dt
  if (guard.nerveTimer < NERVE.updateEvery) return
  const step = guard.nerveTimer
  guard.nerveTimer = 0
  const base = TIERS[guard.tier].nerve
  if ((guard.mode === 'calm' || guard.mode === 'caution') && guard.shock === 0 && guard.hp >= guard.maxHp) {
    guard.nerve = base
    return
  }
  const company = companyOf(world, guard)
  guard.shock = Math.max(0, guard.shock - NERVE.shockFade * step * (1 + company.colleagues))
  guard.nerve = Math.max(0, Math.min(1, base + situation(world, guard, company) - guard.shock))
  if (guard.mode === 'panic' && guard.nerve > NERVE.recovered) pullTogether(world, guard)
  else if (guard.nerve < NERVE.broken && mayBreak(guard)) breakDown(world, guard)
}

/** Only a guard caught up in trouble breaks; a calm one just feels uneasy. */
function mayBreak(guard: Guard): boolean {
  return guard.mode === 'combat' || guard.mode === 'searching' || guard.mode === 'investigating' || guard.mode === 'noticed'
}

type Company = { colleagues: number; officer: boolean }

/** Colleagues awake and close by on his floor, and whether one of them is an officer or a veteran. */
export function companyOf(world: World, guard: Guard, reach: number = NERVE.colleagueReach): Company {
  const feet = feetOf(guard)
  let colleagues = 0
  let officer = false
  for (const other of world.guards) {
    if (other === guard || !isActive(other) || other.mode === 'panic') continue
    if (Math.abs(other.x - guard.x) > reach || Math.abs(other.y + other.h - feet.y) > CLOSE_FLOOR) continue
    colleagues += 1
    officer ||= other.tier === 'veteran' || other.role === 'officer'
  }
  return { colleagues, officer }
}

function situation(world: World, guard: Guard, company: Company): number {
  const feet = feetOf(guard)
  const eye = eyeOf(guard)
  const troubled = guard.mode !== 'calm' && guard.mode !== 'caution'
  let total = Math.min(3, company.colleagues) * NERVE.perColleague + (company.officer ? NERVE.officer : 0)
  const threat = guard.lastKnown
  if (threat && shelteredFrom(world, feet, threat, guard.crouching)) total += NERVE.inCover
  if (troubled && company.colleagues === 0) total -= NERVE.alone
  if (troubled && lightLevelAt(world, eye) < VISION.dim) total -= NERVE.dark
  if (nearestFire(world, eye, 4)) total -= NERVE.fire
  total -= (1 - Math.max(0, guard.hp) / guard.maxHp) * NERVE.wounds
  total -= guard.suppression * NERVE.suppressed
  return total
}

/** A guard was hit: it hurts, and it frightens. */
export function onHurt(guard: Guard): void {
  frighten(guard, NERVE.hit)
}

/**
 * A guard died. The control room's memory of where (so colleagues think twice before walking in), and fright for
 * everyone who saw it or was right beside it. The nearest one who saw it says so.
 */
export function onKilled(world: World, victim: Guard): void {
  const at = centerOf(victim)
  const index = world.guards.indexOf(victim)
  world.security.deaths.push({ at, room: roomOf(world, feetOf(victim))?.id ?? -1, clock: world.clock, victim: index })
  let caller: Guard | null = null
  let callerGap = Infinity
  for (const other of world.guards) {
    if (other === victim || !isActive(other)) continue
    const eye = eyeOf(other)
    const gap = distance(eye, at)
    if (gap > WITNESS_SIGHT) continue
    const saw = clearView(world, eye, at)
    if (!saw && gap > WITNESS_HEARD) continue
    frighten(other, NERVE.colleagueKilled + (gap < 4 ? NERVE.colleagueKilledClose : 0))
    if (saw && gap < callerGap) {
      caller = other
      callerGap = gap
    }
  }
  if (caller) barkLine(world, caller, 'colleagueDown', true, nameOf(index))
}

/** A blast heard close by: the nearer, the worse. */
export function onBlast(guard: Guard, at: Vec): void {
  const gap = distance(eyeOf(guard), at)
  if (gap < NERVE.blastReach) frighten(guard, NERVE.blast * (1 - gap / NERVE.blastReach))
}

/** The time a dead colleague was last seen dying in this room, if recently enough to matter. */
export function recentDeathIn(world: World, room: number, memory: number): boolean {
  return world.security.deaths.some((death) => death.room === room && world.clock - death.clock < memory)
}

/**
 * Bullets and rockets from the player cracking past guards they did not hit (a hit has already been dealt with
 * and the shot is gone). Each near miss pins and frightens; a rocket going by frightens far more.
 * `onShotAt` is told so a guard who had no idea knows someone is shooting at him.
 */
export function watchIncomingFire(world: World, dt: number, onShotAt: (world: World, guard: Guard) => void): void {
  for (const shot of world.projectiles) {
    if (!shot.fromPlayer) continue
    const rocket = shot.kind === 'rocket'
    const range = rocket ? UNDER_FIRE.rocketRange : UNDER_FIRE.nearMissRange
    const from = { x: shot.x - shot.vx * dt, y: shot.y - shot.vy * dt }
    for (const guard of world.guards) {
      if (guard.mode === 'dead' || guard.restrained) continue
      const body = eyeOf(guard)
      if (body.x < Math.min(from.x, shot.x) - range || body.x > Math.max(from.x, shot.x) + range) continue
      if (body.y < Math.min(from.y, shot.y) - range || body.y > Math.max(from.y, shot.y) + range) continue
      if (gapToSegment(body, from, shot) > range) continue
      nearMiss(world, guard, shot, onShotAt)
    }
  }
}

function nearMiss(world: World, guard: Guard, shot: Projectile, onShotAt: (world: World, guard: Guard) => void): void {
  const rocket = shot.kind === 'rocket'
  if (world.clock - guard.nearMissAt < (rocket ? 0.6 : 0.08)) return
  guard.nearMissAt = world.clock
  if (rocket) {
    frighten(guard, NERVE.rocket)
    barkLine(world, guard, 'rocket', true)
  } else {
    guard.suppression = Math.min(1, guard.suppression + UNDER_FIRE.suppressionPerMiss)
    frighten(guard, NERVE.nearMiss)
  }
  if (isActive(guard)) onShotAt(world, guard)
}

function gapToSegment(point: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length))
  return Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t)
}
