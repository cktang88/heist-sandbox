import { idleInput } from '../input'
import { stepWorld } from '../step'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { liveKillZones } from './killZones'
import { GUARD_PISTOL, GUARD_RIFLE, roundReaches } from './lineOfFire'
import { sameFloor } from './places'
import { COMBAT, KILL_ZONES } from './tuning'
import { eyeOf, feetOf, isActive, type Guard } from './model'
import { colleagueInLine } from './combat'
import { FRAME, playerFires, playerHand } from './testArena'

/**
 * Scripted fights for tests: the player holds a spot (pinned there, as if hanging on a rope or crouched on a stair)
 * and shoots at any guard a rifle round could reach, while every guard who knows about the fight is watched for
 * standing about doing nothing. Only tests import this.
 */

/** Seconds a guard who knows there is a fight may go without moving, firing or sheltering (covering fire comes every 1.8 s). */
const IDLE_LIMIT = 3
const WATCH_REACH = 35
/** A short burst every second and a half, aimed roughly: a player under fire, not an aimbot. */
const BURST_EVERY = 1.5
const BURST = 2
const AIM_ERROR = 1.6

type Watch = { at: Vec; rounds: number; since: number }

/**
 * Extra draws from the world's random stream before a scenario starts. A behaviour test runs on each, so it passes on
 * what the guards do, never on one lucky sequence of numbers.
 */
export const PERTURBATIONS = [0, 2, 5]

export function perturb(world: World, draws: number): void {
  for (let draw = 0; draw < draws; draw += 1) world.rng()
}

export type FightReport = { idle: string[]; engaged: number; guardShots: number; log: string[] }

/**
 * Runs a fight for `seconds` with the player held at feet position `spot`, firing short rough bursts at whoever he can hit.
 * It stops early at the first guard caught idle, which already decides the test. `onFrame` runs after every step, for
 * tests that look closer at one guard.
 */
export function scriptedFight(world: World, spot: Vec, seconds: number, onFrame?: (world: World) => void): FightReport {
  world.player.hp = 1e6
  const watches = new Map<Guard, Watch>()
  const idle = new Set<string>()
  const engaged = new Set<Guard>()
  const log: string[] = []
  let guardShots = 0
  let nextBurst = 0
  let shotsLeft = 0
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    Object.assign(world.player, { x: spot.x - world.player.w / 2, y: spot.y - world.player.h - 0.01, vx: 0, vy: 0 })
    if (world.clock >= nextBurst) {
      nextBurst = world.clock + BURST_EVERY
      shotsLeft = BURST
    }
    const target = shotsLeft > 0 && Math.floor(world.clock * 8) !== Math.floor((world.clock - FRAME) * 8) ? targetFor(world) : null
    if (target) {
      shotsLeft -= 1
      playerFires(world, { x: centerOf(target).x + (world.rng() - 0.5) * AIM_ERROR, y: target.y + 0.5 + (world.rng() - 0.5) * AIM_ERROR })
    }
    const before = world.projectiles.filter((shot) => !shot.fromPlayer).length
    stepWorld(world, idleInput({ x: spot.x + 5, y: spot.y - 1 }), FRAME)
    guardShots += Math.max(0, world.projectiles.filter((shot) => !shot.fromPlayer).length - before)
    onFrame?.(world)
    for (const guard of world.guards) {
      if (!aware(world, guard)) {
        watches.delete(guard)
        continue
      }
      engaged.add(guard)
      const watch = watches.get(guard)
      if (!watch || busy(world, guard, watch)) {
        watches.set(guard, { at: feetOf(guard), rounds: guard.rounds, since: world.clock })
        continue
      }
      if (world.clock - watch.since > IDLE_LIMIT) {
        idle.add(describe(world, guard))
        watches.set(guard, { at: feetOf(guard), rounds: guard.rounds, since: world.clock })
      }
    }
    if (Math.floor(world.clock) !== Math.floor(world.clock - FRAME)) log.push(snapshot(world))
    // One man caught idle decides the test: no need to play the fight out.
    if (idle.size > 0) break
  }
  return { idle: [...idle], engaged: engaged.size, guardShots, log }
}

/** The nearest living guard a rifle round from the player could reach. */
function targetFor(world: World): Guard | null {
  const hand = playerHand(world)
  let best: Guard | null = null
  let bestGap = 25
  for (const guard of world.guards) {
    if (!isActive(guard)) continue
    const chest = { x: centerOf(guard).x, y: guard.y + 0.5 }
    const gap = distance(hand, chest)
    if (gap < bestGap && roundReaches(world, hand, chest, 5)) {
      best = guard
      bestGap = gap
    }
  }
  return best
}

/** A guard in the fight near the player. */
function aware(world: World, guard: Guard): boolean {
  return isActive(guard) && guard.mode === 'combat' && distance(feetOf(guard), centerOf(world.player)) < WATCH_REACH
}

/**
 * Moving, firing, reloading, stunned or blinded: anything but standing about. Holding still is a choice, not idling,
 * when it has a reason: raising his gun, holding the choke point he was given, sheltering out of a line of fire, or
 * waiting short of a kill zone. None of those excuse a man who can see the intruder, with a clear shot, and does not take it.
 */
function busy(world: World, guard: Guard, watch: Watch): boolean {
  const feet = feetOf(guard)
  const moved = Math.abs(feet.x - watch.at.x) + Math.abs(feet.y - watch.at.y) > 0.5
  if (moved || guard.rounds !== watch.rounds || guard.reloadSeconds > 0 || guard.blindSeconds > 0 || guard.stairs !== null) return true
  if (guard.flashWindup > 0 || world.clock - guard.clearedAt < 3 || guard.drawSeconds > 0) return true
  // Down behind cover between peeks, out of the line of fire.
  if (guard.shelter !== null && guard.shelter.hidden && !guard.peeking) return true
  if (hasClearShot(world, guard)) return false
  // Holding his spot, or waiting a moment for the man to show again where he just lost him (combat.ts moves him up after that).
  // A man falling back who has reached the spot he fell back to is out of the fight on purpose.
  const atSpot = guard.cover !== null && sameFloor(feet, guard.cover) && Math.abs(feet.x - guard.cover.x) < 1.5
  const holding = (guard.combatRole === 'hold' && (atSpot || guard.lostSeconds <= COMBAT.holdPatience)) || (guard.combatRole === 'fallback' && atSpot)
  return holding || waitingAtKillZone(world, guard)
}

/** He sees the man, and a round of his would get there with no colleague in the way. */
function hasClearShot(world: World, guard: Guard): boolean {
  if (!guard.seesPlayer) return false
  const eye = eyeOf(guard)
  const body = centerOf(world.player)
  return roundReaches(world, eye, body, guard.armored ? GUARD_RIFLE : GUARD_PISTOL) && !colleagueInLine(world, guard, eye, body)
}

/** Holding short of a doorway where colleagues died is a choice the owner asked for ("or wait"), not idling. */
function waitingAtKillZone(world: World, guard: Guard): boolean {
  const feet = feetOf(guard)
  return liveKillZones(world).some((zone) => sameFloor(zone.at, feet) && Math.abs(zone.at.x - feet.x) < KILL_ZONES.radius + 2)
}

function describe(world: World, guard: Guard): string {
  const feet = feetOf(guard)
  return `guard ${world.guards.indexOf(guard)} ${guard.combatRole} at ${feet.x.toFixed(1)},${feet.y.toFixed(0)}`
    + ` sees=${guard.seesPlayer} shelter=${guard.shelter ? (guard.shelter.hidden ? 'hidden' : 'open') + (guard.shelter.spent ? '/spent' : '') + `@${guard.shelter.x.toFixed(1)}` : 'none'}`
    + ` lastKnown=${guard.lastKnown ? `${guard.lastKnown.x.toFixed(0)},${guard.lastKnown.y.toFixed(0)}` : '-'} lost=${guard.lostSeconds.toFixed(1)}`
    + ` route=${guard.search ? `${guard.search.index}/${guard.search.points.length}` : '-'} cover=${guard.cover ? guard.cover.x.toFixed(1) : '-'} t=${world.clock.toFixed(1)}`
}

function snapshot(world: World): string {
  const near = world.guards.filter((guard) => aware(world, guard))
  return `t=${world.clock.toFixed(0)} ` + near.map((guard) => {
    const feet = feetOf(guard)
    return `#${world.guards.indexOf(guard)}:${guard.combatRole}@${feet.x.toFixed(0)},${feet.y.toFixed(0)}${guard.seesPlayer ? '*' : ''}${guard.peeking ? 'p' : ''}${guard.shelter?.hidden ? 's' : ''}`
  }).join(' ')
}
