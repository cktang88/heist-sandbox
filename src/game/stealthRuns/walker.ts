import { nextHop } from '../nav'
import { findLanding } from '../stairs'
import { eyeOf, feetOf, type Guard } from '../security/model'
import { clearView, isAlerted, playerLight } from '../security/perception'
import { VISION } from '../security/tuning'
import { tileAt } from '../tiles'
import { centerOf, type Vec } from '../types'
import type { World } from '../world'
import { blown, feet, FRAME, guardsOnFloor, holdBack, note, pressE, tick, type Run } from './kit'

/**
 * Walking somewhere the way a patient stealth player does: crouched, by the game's own route planner (nav.ts),
 * opening or picking doors on the way, and holding back or backing off whenever a guard on the floor is facing
 * this way close enough to see. A guard standing still with his back turned is slipped past the moment he turns
 * round to face the way the player came (his back is then to the player's goal).
 *
 * The walker knows where the guards are, as a player who peeks, listens and watches cones on screen does.
 */

export type WalkResult = 'arrived' | 'blown' | 'timeout'

const ARRIVED = 0.35
const SAME_FLOOR = 1.5
/** Extra margin past what a guard sees, so a turn of his head does not catch the player. */
const MARGIN = 2.5
/** Right behind a guard: this close, the player slips past instead of backing off. */
const SLIP = 1.7
/** Stuck against a door this long: open or pick it. */
const DOOR_PUSH = 0.15

/** How far this guard could make the player out right now, given the light on the player and his posture. */
export function sightReach(world: World, guard: Guard): number {
  const light = playerLight(world)
  const crouched = world.player.crouching
  const torch = isAlerted(guard) || guard.mode === 'investigating'
  if (light < VISION.dim) return (torch ? VISION.torchDarkRange : VISION.darkRange) * (crouched ? 0.6 : 1)
  return isAlerted(guard) ? VISION.alertRange : VISION.centralRange
}

/** A guard on the player's floor with a clear view who faces him and is close enough to see him, soon if not now. */
export function threatOf(world: World, guard: Guard): 'facing' | 'behind' | null {
  const player = centerOf(world.player)
  const eye = eyeOf(guard)
  const gap = Math.abs(player.x - eye.x)
  if (gap > VISION.alertRange + MARGIN || !clearView(world, eye, player)) return null
  const facing = (player.x - eye.x) * guard.facing > 0
  if (facing && gap <= sightReach(world, guard) + MARGIN) return 'facing'
  return facing ? null : 'behind'
}

export type WalkOptions = {
  timeout?: number
  /** The site level the run may reach before it counts as blown. */
  maxAlert?: number
  /** Take down a guard whose back is turned in the way, rather than wait for him to move. */
  takedowns?: boolean
  /** Take down only the guard posted in this room (the one standing over the case), and nobody else. */
  takedownRoom?: number | null
}

/** Backing off and getting nowhere this long (a wall, a shut door): leave the floor by the stairs for a while. */
const CORNERED = 0.4
const EVADE_SECONDS = 8

/**
 * Walks (crouched) to a spot by the route planner. Returns once there, once the run is blown, or on timeout.
 */
export function walkTo(run: Run, goal: Vec, options: WalkOptions = {}): WalkResult {
  const { timeout = 240, maxAlert = 1, takedowns = false, takedownRoom = null } = options
  const { world } = run
  const until = run.log.seconds + timeout
  let pushing = 0
  let cornered = 0
  let flight: { well: number; to: number; up: boolean } | null = null
  let lastX = world.player.x
  while (run.log.seconds < until) {
    if (blown(run, maxAlert)) return 'blown'
    const at = feet(world)
    if (Math.abs(at.x - goal.x) < ARRIVED && Math.abs(at.y - goal.y) < SAME_FLOOR && !world.player.stairs) return 'arrived'
    if (world.player.stairs) {
      // Hold the key until the landing wanted is close, then let go: the climb carries on to it and steps off there.
      run.waiting = false
      const on = world.player.stairs
      const holding = flight !== null && on.well === flight.well && Math.abs(on.u - flight.to) > 0.5
      tick(run, holding ? { up: flight!.up, down: !flight!.up, crouch: false } : { crouch: false })
      continue
    }
    const hop = nextHop(world.stairwells, at, goal)
    if (hop.kind === 'none') {
      run.log.failure = `no route from ${at.x.toFixed(0)},${at.y.toFixed(0)} to ${goal.x.toFixed(0)},${goal.y.toFixed(0)}`
      return 'timeout'
    }
    const targetX = hop.kind === 'walk' || hop.kind === 'drop' ? hop.x : goal.x
    const direction = hop.kind === 'stairs' ? 0 : (Math.sign(targetX - at.x) as 1 | -1 | 0)
    const plan = choose(world, direction, takedowns, takedownRoom)
    if (plan === 'takedown') {
      pressE(run)
      note(run, `took down a guard at ${feet(world).x.toFixed(0)},${feet(world).y.toFixed(0)}`)
      continue
    }
    const backingOff = plan !== 0 && plan !== direction
    cornered = backingOff && Math.abs(world.player.x - lastX) < 0.002 ? cornered + FRAME : 0
    if (cornered > CORNERED) {
      cornered = 0
      const evaded = evadeByStairs(run, maxAlert)
      if (evaded === 'blown') return 'blown'
      if (evaded) continue
    }
    if (hop.kind === 'stairs' && plan === 0 && !backingOff) {
      run.waiting = false
      flight = { well: hop.well.id, to: hop.stop + hop.direction, up: hop.direction > 0 }
      tick(run, { up: hop.direction > 0, down: hop.direction < 0, crouch: false })
      continue
    }
    if (plan === 0 || backingOff) holdBack(run)
    else run.waiting = false
    // Pushing against a door: open it (or pick its lock) before going on.
    pushing = plan !== 0 && !backingOff && Math.abs(world.player.x - lastX) < 0.002 ? pushing + FRAME : 0
    lastX = world.player.x
    if (pushing > DOOR_PUSH && doorAhead(world, plan)) {
      // Peek first: a guard beyond who faces the door would see it open (and the picked lock) at once.
      if (doorWatched(world, plan)) {
        holdBack(run)
        tick(run)
        continue
      }
      note(run, `opened the door at ${Math.floor(feet(world).x + plan * 0.9)},${Math.round(feet(world).y)}`)
      if (!openAhead(run, plan, maxAlert)) return 'blown'
      pushing = 0
      continue
    }
    tick(run, { left: plan < 0, right: plan > 0 })
  }
  run.log.failure ??= `timed out walking to ${goal.x.toFixed(0)},${goal.y.toFixed(0)}`
  note(run, run.log.failure)
  return 'timeout'
}

/** Cornered on a floor with a guard coming: take the stairs a flight away from him, wait, and come back. */
function evadeByStairs(run: Run, maxAlert: number): boolean | 'blown' {
  const { world } = run
  const at = feet(world)
  const landing = findLanding(world.stairwells, at.x, at.y)
  if (!landing) return false
  const up = landing.stop + 1 < landing.well.stops.length
  note(run, `evaded by the stairs from ${at.x.toFixed(0)},${at.y.toFixed(0)}`)
  for (let frame = 0; frame < 600; frame += 1) {
    tick(run, frame === 0 || world.player.stairs ? { up, down: !up, crouch: false } : {})
    if (frame > 2 && !world.player.stairs) break
  }
  for (let frame = 0; frame < EVADE_SECONDS / FRAME; frame += 1) {
    if (blown(run, maxAlert)) return 'blown'
    holdBack(run)
    tick(run)
  }
  run.waiting = false
  return true
}

/**
 * What to do this frame: move toward the goal (its direction), hold (0), back off from a guard who is facing this
 * way or looking for the player, or take down the guard in reach whose back is turned.
 */
function choose(world: World, direction: 1 | -1 | 0, anyone: boolean, room: number | null): 1 | -1 | 0 | 'takedown' {
  const px = centerOf(world.player).x
  let move = direction
  for (const guard of guardsOnFloor(world)) {
    const threat = threatOf(world, guard)
    if (!threat) continue
    const gx = feetOf(guard).x
    const ahead = direction !== 0 && Math.sign(gx - px) === direction
    const gap = Math.abs(gx - px)
    const away = (Math.sign(px - gx) || -direction || 1) as 1 | -1
    const looking = guard.mode !== 'calm' && guard.mode !== 'caution'
    if (threat === 'facing') {
      // Right in front of him with the goal past him: slip by now rather than back into his view.
      if (ahead && gap < SLIP && !looking) continue
      return away
    }
    // He is looking for something, back turned or not: keep well clear.
    if (looking && gap < sightReach(world, guard) + MARGIN) return away
    const takedowns = anyone || (room !== null && guard.roomId === room && guard.role !== 'patrol')
    if (takedowns && gap < 1.2 && world.prompt === 'E: take down') return 'takedown'
    if (!ahead) continue
    const walkingAway = Math.abs(guard.vx) > 0.3 && Math.sign(guard.vx) === direction && guard.wait <= 0
    if (takedowns) {
      // Close in on a guard whose back is turned; a walking one is followed at a step until he stops.
      if (walkingAway && gap < 2.5) move = 0
      continue
    }
    // A patrol glances back when he pauses: stay out of his reach unless he is walking on.
    if (guard.role === 'patrol' && !walkingAway && gap < sightReach(world, guard) + MARGIN) move = 0
    else if (gap < 1.2 || (walkingAway && gap < 4)) move = 0
  }
  return move
}

/** How far beyond a door the walker peeks for a guard facing it before opening it. */
const PEEK = 16

/** A guard beyond the door ahead, on this floor, who faces it or is walking toward it. */
function doorWatched(world: World, move: number): boolean {
  const px = feet(world).x
  return guardsOnFloor(world).some((guard) => {
    const beyond = (feetOf(guard).x - px) * move
    return beyond > 0 && beyond < PEEK && guard.facing === -move
  })
}

function doorAhead(world: World, move: number): boolean {
  const at = feet(world)
  const column = Math.floor(at.x + move * 0.9)
  return [1, 2].some((up) => tileAt(world.grid, column, Math.floor(at.y - up)) === 'door')
}

/** Opens the door in front: a press for an unlocked one, holding E to pick a locked one. */
function openAhead(run: Run, move: number, maxAlert: number): boolean {
  const { world } = run
  for (let frame = 0; frame < 600 && doorAhead(world, move); frame += 1) {
    if (blown(run, maxAlert)) return false
    const prompt = world.prompt ?? ''
    const door = /door|lock|keypad/.test(prompt)
    tick(run, door ? { interact: true, interactPressed: prompt.startsWith('E:') && frame % 2 === 0 } : { left: move < 0, right: move > 0 })
  }
  return true
}
