import { feetOf, isActive, type Guard } from '../security/model'
import { spotFeet, spotKind, nearestSpot, bodiesIn, roomForBody, spotHides } from '../stealth/spots'
import type { World } from '../world'
import { blown, feet, FRAME, holdBack, note, tick, type Run } from './kit'
import { takedownTarget } from '../stealth/takedown'
import { passerBy } from '../stealth/hide'

/**
 * The stealth toolkit as a careful player uses it, one move at a time: choke a man out and put him in a cupboard,
 * hide in a locker while a patrol walks by, shut a door behind him. Each returns false if the run was blown or the
 * move could not be finished.
 */

/** How far the player will go for a hiding place, and carry a body to one. */
const HIDE_REACH = 7
const CARRY_REACH = 12
/** How long he stays hidden at most, waiting for a patrol to pass. */
const HIDE_SECONDS = 40

/** Steps toward a spot on this floor for up to `seconds`; true once there. */
function stepTo(run: Run, x: number, seconds: number, maxAlert: number): boolean {
  const { world } = run
  for (let frame = 0; frame < seconds / FRAME; frame += 1) {
    if (blown(run, maxAlert)) return false
    const gap = x - feet(world).x
    if (Math.abs(gap) < 0.3) return true
    tick(run, { left: gap < 0, right: gap > 0 })
  }
  return false
}

/** Crouched behind an unaware man: hold E until he goes limp (lifting an officer's keycard first). */
export function chokeOut(run: Run, guard: Guard, maxAlert: number): boolean {
  const { world } = run
  for (let frame = 0; frame < 8 / FRAME; frame += 1) {
    if (blown(run, maxAlert)) return false
    if (guard.out || guard.mode === 'dead') {
      note(run, `choked out guard ${world.guards.indexOf(guard)}`)
      tieUp(run)
      return true
    }
    const busy = world.stealth.choke !== null || /choke|keycard/.test(world.prompt ?? '')
    if (!busy && frame > 0) return false
    tick(run, { interact: true, interactPressed: frame === 0 })
  }
  return false
}

/** Ties up the man just choked out, so he never wakes to call it in. */
function tieUp(run: Run): void {
  for (let frame = 0; frame < 10; frame += 1) {
    if (run.world.prompt?.startsWith('E: tie him up')) {
      pressOnce(run)
      return
    }
    tick(run)
  }
}

function pressOnce(run: Run): void {
  tick(run, { interact: true, interactPressed: true })
}

/** A place a body fits in, near where the player stands, that hides it. */
function cupboardFor(world: World): ReturnType<typeof nearestSpot> {
  return nearestSpot(world, feet(world), (prop, kind) => kind.how !== 'behind' && roomForBody(world, prop) && spotHides(world, prop), CARRY_REACH)
}

/** Picks up the man at his feet, carries him to the nearest cupboard on the floor and shuts him in. */
export function stashBody(run: Run, guard: Guard, maxAlert: number): boolean {
  const { world } = run
  const cupboard = cupboardFor(world)
  if (!cupboard) return false
  if (!stepTo(run, feetOf(guard).x, 2, maxAlert)) return false
  tick(run, { grab: true })
  tick(run)
  if (world.stealth.carried !== world.guards.indexOf(guard)) return false
  if (!stepTo(run, spotFeet(cupboard).x, 12, maxAlert)) return false
  for (let frame = 0; frame < 30 && world.stealth.carried !== null; frame += 1) tick(run, { interact: true, interactPressed: frame % 2 === 0 })
  if (world.stealth.carried !== null) return false
  note(run, `hid the body in the ${spotKind(cupboard.kind)?.name}`)
  return true
}

/** A hiding place for the player within reach that is not toward the guard. */
function lockerAwayFrom(world: World, guard: Guard): ReturnType<typeof nearestSpot> {
  const px = feet(world).x
  const gx = feetOf(guard).x
  return nearestSpot(world, feet(world), (prop, kind) => {
    if (!kind.player || kind.how === 'behind' || bodiesIn(world, prop).length >= kind.bodies) return false
    const x = spotFeet(prop).x
    return Math.abs(x - gx) > Math.abs(px - gx) - 1.5 && Math.abs(x - gx) > 2.5
  }, HIDE_REACH)
}

/**
 * A patrol is due back this way: slip into the nearest locker while his back is turned, wait until he has come and
 * gone again, and come out. Returns false if blown or there was nowhere to hide.
 */
export function hideUntilPassed(run: Run, guard: Guard, maxAlert: number): boolean {
  const { world } = run
  const locker = lockerAwayFrom(world, guard)
  if (!locker) return false
  if (!stepTo(run, spotFeet(locker).x, 4, maxAlert)) return false
  // Only when E means hiding: with a guard in reach it would mean grabbing him instead.
  if (!/^E: (hide in|crawl under)/.test(world.prompt ?? '')) return false
  tick(run, { interact: true, interactPressed: true })
  if (!world.player.hidden) return false
  note(run, `hid in the ${spotKind(locker.kind)?.name} from guard ${world.guards.indexOf(guard)}`)
  let came = false
  let gone = 0
  for (let frame = 0; frame < HIDE_SECONDS / FRAME; frame += 1) {
    if (blown(run, maxAlert)) return false
    holdBack(run)
    tick(run)
    if (seizeStartled(run, maxAlert)) return !blown(run, maxAlert)
    if (!world.player.hidden) return true
    const offset = feetOf(guard).x - feet(world).x
    const elsewhere = !isActive(guard) || Math.abs(feetOf(guard).y - feet(world).y) > 1.5
    if (!came && !elsewhere && (offset * guard.facing < 0 || Math.abs(offset) < 2)) came = true
    if (!came && frame * FRAME > HIDE_SECONDS / 2) break
    gone = came && (elsewhere || (Math.abs(offset) > 4 && offset * guard.facing > 0)) ? gone + FRAME : 0
    if (gone > 1.5) break
  }
  run.waiting = false
  for (let frame = 0; frame < 20 && world.player.hidden; frame += 1) {
    // Never out onto a man right in front: E would grab him.
    if (passerBy(world)) holdBack(run)
    tick(run, passerBy(world) ? {} : { interact: true, interactPressed: frame % 2 === 0 })
  }
  return !world.player.hidden
}

/** A guard frozen in surprise right in front of the player: choke him before the beat runs out. Returns true if there was one. */
export function seizeStartled(run: Run, maxAlert: number): boolean {
  const { world } = run
  const target = takedownTarget(world)
  if (!target?.startled) return false
  note(run, `seized startled guard ${world.guards.indexOf(target.guard)}`)
  if (chokeOut(run, target.guard, maxAlert)) stashBody(run, target.guard, maxAlert)
  return true
}
