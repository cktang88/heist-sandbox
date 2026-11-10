import type { Charge } from '../charges'
import { C4_BLAST } from '../explosions'
import { cutLine } from '../grapple/hook'
import { tileAt, type Grid } from '../tiles'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { barkLine, bark } from './barks'
import { startRadio } from './comms'
import type { Finding } from './discoveries'
import { eyeOf, feetOf, isActive, type Guard } from './model'
import { goTo } from './movement'
import { startSearch } from './orders'
import { clearView, zoneOf } from './perception'
import { floorBelow, sameFloor } from './places'
import { log, raiseLevel } from './report'
import { DISCOVERY, PATROL } from './tuning'

/**
 * Signs of the intruder's newer tricks, noticed the way a guard notices an open door: a grappling line left hanging
 * outside, a window pane missing, a C4 charge stuck to a wall, a colleague tied up. Each is noticed once, by the first
 * guard to see it. Nobody stands next to a charge anyone has seen.
 */

const LINE_SIGHT = 14
const CHARGE_SIGHT = 12
const TIED_SIGHT = 12
/** Out of a charge's blast, with a margin: nobody who knows about it comes closer than this. A function: explosions.ts loads after this file. */
export function chargeKeepOff(): number {
  return C4_BLAST.radius + 2
}
/** An officer sends this many seconds of searching round a charge. */
const CHARGE_SEARCH = 40
/** Standing at the hook he can cut the line. */
const LINE_REACH = 3

// --- The grappling line -----------------------------------------------------------------------------------------

/** The grappling line left hanging on the outside of a building (the player let go of it to climb in), in his view. */
export function lineLeftHanging(world: World, guard: Guard): Finding | null {
  const grapple = world.grapple
  if (grapple.phase !== 'parked' || !grapple.anchor || world.security.lineNoticed) return null
  const eye = eyeOf(guard)
  const nearest = nearestOnSegment(eye, { x: grapple.anchor.x + 0.5, y: grapple.anchor.y + 0.5 }, grapple.body)
  if ((nearest.x - eye.x) * guard.facing < -1 || distance(eye, nearest) > LINE_SIGHT || !clearView(world, eye, nearest)) return null
  world.security.lineNoticed = true
  const hook = floorBelow(world, { x: grapple.anchor.x + 0.5, y: grapple.anchor.y - 0.5 })
  return { at: hook, kind: 'tamper', priority: 5, line: 'grappleLine', tamper: 'line', report: { kind: 'tamper', at: hook, what: 'line' } }
}

/** At the hook: he works it loose, so the line is no way back out. */
export function cutLineNear(world: World, guard: Guard, at: Vec): void {
  const anchor = world.grapple.anchor
  if (world.grapple.phase !== 'parked' || !anchor || distance({ x: anchor.x + 0.5, y: anchor.y + 0.5 }, at) > LINE_REACH + 3) return
  cutLine(world)
  barkLine(world, guard, 'cutRope')
}

function nearestOnSegment(point: Vec, a: Vec, b: Vec): Vec {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = dx * dx + dy * dy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length))
  return { x: a.x + dx * t, y: a.y + dy * t }
}

// --- Window panes -------------------------------------------------------------------------------------------------

const paneIndexes = new WeakMap<Grid, Map<number, number[]>>()

/** Glass tiles by row, as the site was built. Taken on the first call (from the first security step), before anyone breaks one. */
function panesByRow(grid: Grid): Map<number, number[]> {
  let index = paneIndexes.get(grid)
  if (index) return index
  index = new Map()
  for (let y = 0; y < grid.height; y += 1) {
    for (let x = 0; x < grid.width; x += 1) if (tileAt(grid, x, y) === 'glass') index.set(y, [...(index.get(y) ?? []), x])
  }
  paneIndexes.set(grid, index)
  return index
}

export function indexPanes(world: World): void {
  panesByRow(world.grid)
}

/**
 * A window pane missing on his floor, ahead of him and in view: cut out quietly (or broken where he did not hear it).
 * Like a door left open, it is only noticed when seen.
 */
export function paneMissing(world: World, guard: Guard): Finding | null {
  const index = panesByRow(world.grid)
  const feet = feetOf(guard)
  const eye = eyeOf(guard)
  const noticed = world.security.panesNoticed
  for (let up = 1; up <= 4; up += 1) {
    const row = Math.round(feet.y) - up
    for (const x of index.get(row) ?? []) {
      const ahead = (x + 0.5 - feet.x) * guard.facing
      if (ahead < -1 || ahead > DISCOVERY.doorSight || tileAt(world.grid, x, row) !== 'air') continue
      const key = `${x},${row}`
      if (noticed.has(key) || !clearView(world, eye, { x: x + 0.5, y: row + 0.5 })) continue
      // The rest of that window counts as noticed with it.
      for (let other = row - 4; other <= row + 4; other += 1) noticed.add(`${x},${other}`)
      const at = { x: x + 0.5, y: feet.y }
      return { at, kind: 'tamper', priority: 4, line: 'windowOpen', tamper: 'window', report: { kind: 'tamper', at, what: 'window' } }
    }
  }
  return null
}

// --- C4 ---------------------------------------------------------------------------------------------------------------

/** He has just seen a charge stuck to a wall, door or ceiling: he shouts it and radios it in, and an officer sends a man. */
function spotCharge(world: World, guard: Guard, charge: Charge): void {
  world.security.chargesSeen.add(charge)
  barkLine(world, guard, 'charge', true)
  const at = floorBelow(world, centerOf(charge))
  if (!guard.radio) startRadio(world, guard, { kind: 'tamper', at, what: 'charge' })
  sendOfficersMan(world, guard, at)
}

function visibleCharge(world: World, guard: Guard, wanted: (charge: Charge) => boolean): Charge | null {
  if (world.charges.length === 0) return null
  const eye = eyeOf(guard)
  for (const charge of world.charges) {
    if (charge.stuck === null || !wanted(charge)) continue
    const at = centerOf(charge)
    if (distance(eye, at) > CHARGE_SIGHT || zoneOf(guard, eye, at) === null || !clearView(world, eye, at)) continue
    return charge
  }
  return null
}

/** An officer on site sends the nearest calm man to search round the charge for whoever planted it. */
function sendOfficersMan(world: World, finder: Guard, at: Vec): void {
  const officer = world.guards.find((guard) => guard.role === 'officer' && isActive(guard))
  if (!officer) return
  const sent = world.guards
    .filter((guard) => guard !== finder && isActive(guard) && (guard.mode === 'calm' || guard.mode === 'caution'))
    .sort((a, b) => distance(feetOf(a), at) - distance(feetOf(b), at))[0]
  if (!sent) return
  startSearch(world, sent, at, CHARGE_SEARCH)
  log(world, 'Officer: Someone planted that charge. Find him, and stay clear of it.')
}

/**
 * Keeps a guard out of the blast of any charge someone has seen, and of one he can see himself (noticing it and calling
 * it in, even in a fight). Returns true while he is backing away.
 */
export function keepOffCharges(world: World, guard: Guard, dt: number): boolean {
  if (world.charges.length === 0) return false
  const feet = feetOf(guard)
  const seen = world.security.chargesSeen
  const spotted = visibleCharge(world, guard, (charge) => !seen.has(charge))
  if (spotted) spotCharge(world, guard, spotted)
  const near = world.charges.find((charge) => seen.has(charge) && charge.fuse === null && distance(centerOf(charge), feet) < chargeKeepOff() && sameFloor(floorBelow(world, centerOf(charge)), feet))
  if (!near) return false
  const away = Math.sign(feet.x - centerOf(near).x) || -guard.facing
  goTo(world, guard, { x: centerOf(near).x + away * (chargeKeepOff() + 1), y: feet.y }, PATROL.runSpeed, dt, false)
  return true
}

// --- A colleague tied up ----------------------------------------------------------------------------------------------

/** A colleague tied up where he can see him. He goes over to free him. */
export function tiedColleague(world: World, guard: Guard): Finding | null {
  const eye = eyeOf(guard)
  for (const other of world.guards) {
    if (other === guard || !other.restrained || other.mode === 'dead' || world.security.tiedNoticed.has(other)) continue
    const at = centerOf(other)
    if (distance(eye, at) > TIED_SIGHT || zoneOf(guard, eye, at) === null || !clearView(world, eye, at)) continue
    world.security.tiedNoticed.add(other)
    return { at: feetOf(other), kind: 'tamper', priority: 6, line: 'tiedUp', tamper: 'hostage' }
  }
  return null
}

/**
 * At the tied-up colleague: he cuts him loose (he goes back for his weapon), and hears what happened. If the intruder
 * questioned him about the case, the control room knows what he is after: the alert is confirmed, and the case is
 * moved (intel/move.ts reads `caseAskedAbout`).
 */
export function untieNear(world: World, at: Vec): void {
  const freed = world.guards.find((other) => other.restrained && other.mode !== 'dead' && distance(feetOf(other), at) < 2.5)
  if (!freed) return
  freed.restrained = false
  freed.unwatchedSeconds = 1e3
  if (world.intel.questioned.has(freed)) {
    bark(world, freed, 'He was asking about the case!', true)
    world.security.caseAskedAt = world.clock
    log(world, 'Control: Intruder questioned one of ours about the package. Confirmed hostile.')
    raiseLevel(world, 3)
  } else bark(world, freed, 'Took you long enough. He went that way.', true)
}

/** Has a freed colleague told control the intruder was asking about the case? For intel's "move the package". */
export function caseAskedAbout(world: World): boolean {
  return world.security.caseAskedAt > -Infinity
}
