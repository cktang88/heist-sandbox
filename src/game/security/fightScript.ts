import { idleInput } from '../input'
import { stepWorld } from '../step'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { liveKillZones } from './killZones'
import { roundReaches } from './lineOfFire'
import { sameFloor } from './places'
import { KILL_ZONES } from './tuning'
import { feetOf, isActive, type Guard } from './model'
import { FRAME, playerFires, playerHand } from './testArena'

/**
 * Scripted fights for tests: the player holds a spot (pinned there, as if hanging on a rope or crouched on a stair)
 * and shoots at any guard a rifle round could reach, while every guard who knows about the fight is watched for
 * standing about doing nothing. Only tests import this.
 */

/** Seconds a guard who knows there is a fight may go without moving, firing or sheltering. */
const IDLE_LIMIT = 2
const WATCH_REACH = 35
/** A short burst every second and a half, aimed roughly: a player under fire, not an aimbot. */
const BURST_EVERY = 1.5
const BURST = 2
const AIM_ERROR = 1.6

type Watch = { at: Vec; rounds: number; since: number }

export type FightReport = { idle: string[]; engaged: number; guardShots: number; log: string[] }

/** Runs a fight for `seconds` with the player held at feet position `spot`, firing short rough bursts at whoever he can hit. */
export function scriptedFight(world: World, spot: Vec, seconds: number): FightReport {
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

/** Moving, firing, reloading, sheltering, stunned or blinded: anything but standing about. */
function busy(world: World, guard: Guard, watch: Watch): boolean {
  const feet = feetOf(guard)
  const moved = Math.abs(feet.x - watch.at.x) + Math.abs(feet.y - watch.at.y) > 0.5
  return moved || guard.rounds !== watch.rounds || guard.reloadSeconds > 0 || guard.blindSeconds > 0 || guard.stairs !== null
    || guard.flashWindup > 0 || (guard.shelter !== null && guard.shelter.hidden && guard.shelter.peek !== null) || world.clock - guard.clearedAt < 3
    || waitingAtKillZone(world, guard)
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
