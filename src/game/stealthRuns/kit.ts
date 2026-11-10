import { idleInput, type Input } from '../input'
import { feetOf, isActive, type Guard } from '../security/model'
import { playerLight } from '../security/perception'
import { VISION } from '../security/tuning'
import { stepWorld } from '../step'
import type { Vec } from '../types'
import { createWorld, type World } from '../world'

/**
 * A scripted player for measuring stealth: pure helpers on top of `stepWorld` and `Input`, each one a thing a careful
 * player does (walk somewhere crouched, wait for a guard's back, hold E on something). Every frame goes through
 * `tick`, which keeps the record a playtester would write down: how long it took, how often the player was seen,
 * how high the site alert went, and how much of the time was spent waiting.
 */

export const FRAME = 1 / 60

export type RunLog = {
  seconds: number
  /** Guards who positively identified the player (the game's own count). */
  spotted: number
  peakAlert: number
  /** Separate stretches of waiting for a gap, and their total length. */
  waits: number
  waitSeconds: number
  /** Frames walked in light a guard would see by (at or above VISION.lit), and in all. */
  litFrames: number
  movingFrames: number
  /** Why the run stopped short, or null if it did what it set out to do. */
  failure: string | null
  /** Short notes on what happened, in order, for a failing test to print. */
  notes: string[]
}

export type Run = { world: World; log: RunLog; crouch: boolean; waiting: boolean }

/** A fresh heist on the big complex, the player at the drop start, every guard on duty. */
export function startRun(seed: number): Run {
  const world = createWorld(seed, 'complex')
  const log: RunLog = { seconds: 0, spotted: 0, peakAlert: 0, waits: 0, waitSeconds: 0, litFrames: 0, movingFrames: 0, failure: null, notes: [] }
  return { world, log, crouch: true, waiting: false }
}

export function note(run: Run, line: string): void {
  run.log.notes.push(`${run.log.seconds.toFixed(1)}s ${line}`)
}

/** One frame with this input (crouched unless told otherwise), recorded. */
export function tick(run: Run, input: Partial<Input> = {}): void {
  const { world, log } = run
  const player = world.player
  const aim = { x: player.x + player.w / 2 + (player.vx >= 0 ? 5 : -5), y: player.y + 0.5 }
  stepWorld(world, { ...idleInput(aim), crouch: run.crouch, ...input }, FRAME)
  log.seconds += FRAME
  log.spotted = world.stats.timesSpotted
  log.peakAlert = Math.max(log.peakAlert, world.security.level)
  if (Math.abs(player.vx) > 0.6) {
    log.movingFrames += 1
    if (playerLight(world) >= VISION.lit) log.litFrames += 1
  }
}

/** Ticks for a while, stopping early when `until` says so. Returns true if `until` was met. */
export function wait(run: Run, seconds: number, until?: () => boolean, input: Partial<Input> = {}): boolean {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    if (until?.()) return true
    tick(run, input)
  }
  return until?.() ?? false
}

/** Counts a stretch of standing still for a gap: called each frame the player holds back. */
export function holdBack(run: Run): void {
  if (!run.waiting) run.log.waits += 1
  run.waiting = true
  run.log.waitSeconds += FRAME
}

/** Puts the player's feet at a spot, standing still (a starting position, never a shortcut in the middle of a run). */
export function placeAt(world: World, x: number, feetY: number): void {
  Object.assign(world.player, { x: x - world.player.w / 2, y: feetY - world.player.h - 0.01, vx: 0, vy: 0, chute: false, stairs: null })
}

export function feet(world: World): Vec {
  return feetOf(world.player)
}

/** Holds E until the prompt changes or the time runs out (picking a lock, hacking, reading). Returns true if it finished. */
export function holdE(run: Run, seconds: number, done: () => boolean): boolean {
  return wait(run, seconds, done, { interact: true })
}

export function pressE(run: Run): void {
  tick(run, { interact: true, interactPressed: true })
}

/** Guards still able to act, on the player's floor. */
export function guardsOnFloor(world: World): Guard[] {
  const y = feet(world).y
  return world.guards.filter((guard) => isActive(guard) && Math.abs(feetOf(guard).y - y) < 1.5)
}

/** The site is no longer calm about the player: someone saw him, or the alert passed the level allowed. */
export function blown(run: Run, maxAlert = 1): boolean {
  return run.log.spotted > 0 || run.world.security.level > maxAlert
}
