import { nextHop } from '../nav'
import { findLanding } from '../stairs'
import { eyeOf, feetOf, type Guard } from '../security/model'
import { clearView } from '../security/perception'
import { VISION } from '../security/tuning'
import { tileAt } from '../tiles'
import { centerOf, type Vec } from '../types'
import type { World } from '../world'
import { blown, feet, FRAME, guardsOnFloor, holdBack, note, pressE, tick, type Run } from './kit'
import { cameraSays, MARGIN, sightReach, threatOf } from './sight'
import { chokeOut, hideUntilPassed, seizeStartled, stashBody } from './moves'
import { takedownTarget } from '../stealth/takedown'

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
/** Right behind a guard: this close, the player slips past instead of backing off. */
const SLIP = 1.7
/** Stuck against a door this long: open or pick it. */
const DOOR_PUSH = 0.15

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
  let behind: Behind | null = null
  let hidAt = -Infinity
  const hides = new Map<Guard, number>()
  let movedAt = run.log.seconds
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
    if (behind && closeBehind(run, behind)) behind = null
    if (seizeStartled(run, maxAlert)) continue
    const worthHiding = (guard: Guard) => (hides.get(guard) ?? 0) < PATIENCE && !(takedownRoom !== null && guard.roomId === takedownRoom)
    const due = run.log.seconds - hidAt > HIDE_AGAIN ? patrolDue(world, worthHiding) ?? patrolComing(world, worthHiding) : null
    if (due) {
      hidAt = run.log.seconds
      hides.set(due, (hides.get(due) ?? 0) + 1)
      if (hideUntilPassed(run, due, maxAlert)) continue
    }
    if (blown(run, maxAlert)) return 'blown'
    // Held up this long by a man who will not move out of the way: he is taken down too.
    const blocked = run.log.seconds - movedAt > BLOCKED
    const guards = choose(world, direction, (guard) => blocked || takedowns || (takedownRoom !== null && guard.roomId === takedownRoom) || (hides.get(guard) ?? 0) >= PATIENCE)
    // A camera's sweep counts like a guard's eyes: out of it, or wait for it to swing past.
    const camera = guards === direction ? cameraSays(world, direction) : null
    const plan = camera ?? guards
    if (plan === 'takedown') {
      const target = takedownTarget(world)?.guard
      if (target && chokeOut(run, target, maxAlert)) stashBody(run, target, maxAlert)
      else tick(run)
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
    if (plan !== 0 && !backingOff) movedAt = run.log.seconds
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
      const column = Math.floor(feet(world).x + plan * 0.9)
      note(run, `opened the door at ${column},${Math.round(feet(world).y)}`)
      if (!openAhead(run, plan, maxAlert)) return 'blown'
      behind = { x: column + 0.5, y: feet(world).y, dir: plan }
      pushing = 0
      continue
    }
    tick(run, { left: plan < 0, right: plan > 0 })
  }
  run.log.failure ??= `timed out walking to ${goal.x.toFixed(0)},${goal.y.toFixed(0)}`
  note(run, run.log.failure)
  return 'timeout'
}

/** A door the player opened and walked through, to shut behind him once he is past it. */
type Behind = { x: number; y: number; dir: number }

/** Clear of the doorway on the far side: shut it, crouched (silent). Returns true once it is done with (shut, or left behind). */
function closeBehind(run: Run, door: Behind): boolean {
  const at = feet(run.world)
  const past = (at.x - door.x) * door.dir
  if (Math.abs(at.y - door.y) > SAME_FLOOR || past < -0.5 || past > 2.5) return true
  if (past < 1.2 || run.world.prompt !== 'E: ease the door shut (silent)') return false
  pressE(run)
  note(run, `shut the door at ${Math.floor(door.x)},${Math.round(door.y)}`)
  return true
}

/** Held up this long without moving on: whoever is in the way is taken down. */
const BLOCKED = 12
/** Hidden from the same patrol this often, the player stops waiting for him and takes him down from behind. */
const PATIENCE = 2
/** A calm guard walking this way on the player's floor, not yet close enough to see him. */
function patrolComing(world: World, worthIt: (guard: Guard) => boolean): Guard | null {
  const player = centerOf(world.player)
  return guardsOnFloor(world).find((guard) => {
    const gap = player.x - feetOf(guard).x
    const toward = Math.abs(guard.vx) > 0.3 && Math.sign(guard.vx) === Math.sign(gap)
    return worthIt(guard) && (guard.mode === 'calm' || guard.mode === 'caution') && toward && Math.abs(gap) > 3 && Math.abs(gap) < DUE && clearView(world, eyeOf(guard), player)
  }) ?? null
}

/** Out of a hiding place, the player gets on with it for this long before hiding again. */
const HIDE_AGAIN = 20
/** How far off a patrol is still worth hiding from. */
const DUE = 10

/**
 * A patrol on this floor, his back to the player, whose beat takes him past where the player stands: he will turn
 * and come this way. Hide now, while he cannot see the player climb in.
 */
function patrolDue(world: World, worthIt: (guard: Guard) => boolean): Guard | null {
  const player = centerOf(world.player)
  return guardsOnFloor(world).find((guard) => {
    if (!worthIt(guard) || guard.role !== 'patrol' || (guard.mode !== 'calm' && guard.mode !== 'caution') || guard.route.length < 2) return false
    const gap = player.x - feetOf(guard).x
    const xs = guard.route.map((point) => point.x)
    const covers = player.x > Math.min(...xs) - 1 && player.x < Math.max(...xs) + 1
    return covers && Math.abs(gap) < DUE && Math.abs(gap) > 3 && gap * guard.facing < 0 && clearView(world, eyeOf(guard), player)
  }) ?? null
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
function choose(world: World, direction: 1 | -1 | 0, mayTakeDown: (guard: Guard) => boolean): 1 | -1 | 0 | 'takedown' {
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
    const takedowns = mayTakeDown(guard)
    if (takedowns && gap < 1.2 && /choke out|lift his keycard/.test(world.prompt ?? '') && unwatched(world, guard)) return 'takedown'
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

/** Nobody but the man himself can see the player from here: a takedown in front of a colleague is no takedown. */
function unwatched(world: World, target: Guard): boolean {
  const player = centerOf(world.player)
  return guardsOnFloor(world).every((guard) => {
    if (guard === target) return true
    const gap = player.x - feetOf(guard).x
    return Math.abs(gap) > VISION.alertRange || !clearView(world, eyeOf(guard), player) || (gap * guard.facing < 0 && Math.abs(gap) > 3)
  })
}

/** How far beyond a door the walker peeks for a guard facing it before opening it. */
const PEEK = 16

/** A guard beyond the door ahead, on this floor, who faces it or is walking toward it. */
function doorWatched(world: World, move: number): boolean {
  const px = feet(world).x
  // Opening takes a while: a man standing post just beyond must not be due to turn round before it is open and passed.
  const needed = DOOR_WORK + DOOR_SLACK
  return guardsOnFloor(world).some((guard) => {
    const beyond = (feetOf(guard).x - px) * move
    if (beyond <= 0 || beyond >= PEEK) return false
    // (An operator at his console never turns.)
    return guard.facing === -move || (guard.role !== 'patrol' && guard.role !== 'operator' && Math.abs(guard.vx) < 0.3 && beyond < 8 && guard.wait < needed)
  })
}

/** Seconds of work on a lock or keypad, at most, and a little to step through after. */
const DOOR_WORK = 3
const DOOR_SLACK = 2

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
    const door = /door|lock|keypad|keycard/.test(prompt) && !/shut|close/.test(prompt)
    tick(run, door ? { interact: true, interactPressed: prompt.startsWith('E:') && frame % 2 === 0 } : { left: move < 0, right: move > 0 })
  }
  return true
}
