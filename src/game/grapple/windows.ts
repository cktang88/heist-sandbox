import { hurtTile } from '../destruction'
import type { Input } from '../input'
import { smashGlass } from '../melee/knock'
import { startMantle } from '../movement/ledge'
import { CROUCH_HEIGHT, STAND_HEIGHT } from '../movement/posture'
import { emitNoise } from '../noise'
import { boxHitsSolid } from '../physics'
import { isSolidAt, tileAt, type Grid } from '../tiles'
import { distance, type Vec } from '../types'
import type { World } from '../world'
import { releaseHook } from './hook'
import { onLine } from './state'

/**
 * Windows as ways in and out. A window is a short opening (glass, or already broken) in a wall, with solid wall above
 * and a sill below that stands out of the wall on the player's side, which is what tells it from a doorway. From
 * beside one (on a rope, a ladder, the grapple line, or standing at it) E goes through: a tap smashes the glass, holding
 * cuts it quietly; either way he climbs through in one short vault onto the far side at sill height.
 */
export type WindowSpot = {
  x: number
  top: number
  bottom: number
  /** Which way he goes through: +1 to the right. */
  side: 1 | -1
  glass: boolean
  /** Where his body ends up (top-left corner and height) on the far side, just past the wall at sill height. */
  landing: Vec & { h: number }
  /** True when there is floor under the landing; otherwise he drops (or takes the rope or line there). */
  footing: boolean
  key: string
}

/** The interact action shape (`interact.ts`): `hold` seconds of E, or a single press without it. */
export type WindowAction = { prompt: string; key: string; run: () => void; hold?: number }

export const VAULT_SECONDS = 0.5
export const CUT_SECONDS = 3
/** A press shorter than this on a window is a tap, and smashes it. */
const TAP_SECONDS = 0.3
/** Cutting glass is a faint scrape: only someone right beside the window could hear it. */
const CUT_NOISE = 1.5
const REACH = 1.7
const MIN_OPENING = 2
const MAX_OPENING = 5
/** Floor this far under the landing counts as footing: a drop of a couple of rows is a step down, not a fall. */
const FOOTING_ROWS = 3
const WALL_GAP = 0.02
/** Speed toward glass (sideways in the air, or falling onto it) that crashes straight through it. */
const CRASH_SPEED = 8.5
const CRASH_FALL_SPEED = 14
const CRASH_HURT = 8
const DOOR_REACH = 2

/** The window he could go through right now, nearest first, or null. */
export function findWindow(world: World): WindowSpot | null {
  const player = world.player
  const centre = player.x + player.w / 2
  let best: WindowSpot | null = null
  let bestGap = Number.POSITIVE_INFINITY
  for (let x = Math.floor(centre) - 2; x <= Math.floor(centre) + 2; x += 1) {
    const gap = Math.abs(x + 0.5 - centre)
    if (gap > REACH || gap >= bestGap) continue
    const side: 1 | -1 = centre < x + 0.5 ? 1 : -1
    for (let row = Math.floor(player.y) - 1; row <= Math.floor(player.y + player.h) + 1; row += 1) {
      const spot = windowAt(world, x, row, side)
      if (!spot) continue
      best = spot
      bestGap = gap
      break
    }
  }
  return best
}

/** The window whose opening includes this tile, seen from the `-side` of it, if it is one he fits through. */
export function windowAt(world: World, x: number, row: number, side: 1 | -1): WindowSpot | null {
  const grid = world.grid
  if (!isOpening(grid, x, row)) return null
  let top = row
  let bottom = row
  while (row - top < MAX_OPENING && isOpening(grid, x, top - 1)) top -= 1
  while (bottom - row < MAX_OPENING && isOpening(grid, x, bottom + 1)) bottom += 1
  const rows = bottom - top + 1
  if (rows < MIN_OPENING || rows > MAX_OPENING || !isWall(grid, x, top - 1) || !isWall(grid, x, bottom + 1)) return null
  const sill = bottom + 1
  // The sill must stand clear on both sides; a doorway's "sill" is the floor, which runs on either side.
  if (isSolidAt(grid, x - side, sill) || isSolidAt(grid, x + side, sill)) return null
  let glass = false
  for (let y = top; y <= bottom; y += 1) {
    if (tileAt(grid, x, y) === 'glass') glass = true
    if (isSolidAt(grid, x - side, y)) return null
  }
  const landing = landingPast(world, x, sill, side, rows)
  if (!landing) return null
  return { x, top, bottom, side, glass, landing, footing: hasFooting(grid, landing, world.player.w), key: `window:${x}:${top}` }
}

function isOpening(grid: Grid, x: number, y: number): boolean {
  const kind = tileAt(grid, x, y)
  return kind === 'glass' || kind === 'air'
}

function isWall(grid: Grid, x: number, y: number): boolean {
  return isSolidAt(grid, x, y) && tileAt(grid, x, y) !== 'glass'
}

/** Standing room just past the wall at sill height, standing if the opening is tall enough, otherwise crouched. */
function landingPast(world: World, x: number, sill: number, side: 1 | -1, rows: number): (Vec & { h: number }) | null {
  const w = world.player.w
  const left = side > 0 ? x + 1 + WALL_GAP : x - w - WALL_GAP
  for (const h of [STAND_HEIGHT, CROUCH_HEIGHT]) {
    if (h > rows) continue
    const landing = { x: left, y: sill - h - WALL_GAP, h }
    if (!boxHitsSolid(world.grid, { ...landing, w })) return landing
  }
  return null
}

function hasFooting(grid: Grid, landing: Vec & { h: number }, w: number): boolean {
  const feet = Math.round(landing.y + landing.h)
  for (let row = feet; row < feet + FOOTING_ROWS; row += 1) {
    if (isSolidAt(grid, landing.x + 0.05, row) || isSolidAt(grid, landing.x + w - 0.05, row)) return true
  }
  return false
}

/** Hanging on something, or standing: a body in free fall cannot work a window. */
function canWorkWindow(world: World): boolean {
  const player = world.player
  if (player.mantle || player.stairs || world.grapple.vault > 0) return false
  return player.onGround || player.onLadder || onLine(world.grapple)
}

/**
 * What E does at a window, for `interact.ts` to rank below takedowns and devices and above doors. While hanging on the
 * grapple line with no window (or door) in reach, E lets go of the line.
 */
export function windowAction(world: World): WindowAction | null {
  if (!canWorkWindow(world)) return null
  const spot = findWindow(world)
  if (!spot) return lineAction(world)
  const where = destination(world, spot)
  if (!spot.glass) {
    return { prompt: where === 'jump' ? 'E: jump out' : `E: ${where}`, key: spot.key, run: () => climbThrough(world, spot) }
  }
  const prompt = `E: break window and ${where} · Hold E: cut glass`
  world.grapple.offer = { key: spot.key, prompt }
  return { prompt, key: spot.key, hold: CUT_SECONDS, run: () => cutThrough(world, spot) }
}

function lineAction(world: World): WindowAction | null {
  if (!onLine(world.grapple) || doorNear(world)) return null
  return { prompt: 'E: let go', key: 'grapple:release', run: () => releaseHook(world) }
}

function doorNear(world: World): boolean {
  const player = world.player
  const centre = { x: player.x + player.w / 2, y: player.y + player.h / 2 }
  for (let y = Math.floor(centre.y - DOOR_REACH); y <= Math.floor(centre.y + DOOR_REACH); y += 1) {
    for (let x = Math.floor(centre.x - DOOR_REACH); x <= Math.floor(centre.x + DOOR_REACH); x += 1) if (tileAt(world.grid, x, y) === 'door') return true
  }
  return false
}

/** What lies past the window, for the prompt: a room to climb into, something to climb out onto, or a drop. */
function destination(world: World, spot: WindowSpot): 'climb in' | 'climb out' | 'jump' {
  const at = { x: spot.landing.x + world.player.w / 2, y: spot.landing.y + spot.landing.h }
  if (spot.footing) return world.rooms.some((room) => at.x >= room.x && at.x < room.x + room.w && at.y > room.y && at.y <= room.floorY + 0.5) ? 'climb in' : 'climb out'
  return lineReaches(world, spot) || ropeAt(world, spot) ? 'climb out' : 'jump'
}

/** The parked line is long enough to take hold of from the landing. */
function lineReaches(world: World, spot: WindowSpot): boolean {
  const grapple = world.grapple
  if (grapple.phase !== 'parked') return false
  const grip = { x: spot.landing.x + world.player.w / 2, y: spot.landing.y + 0.15 }
  return distance(grip, grapple.hook) <= grapple.length + 1
}

function ropeAt(world: World, spot: WindowSpot): boolean {
  const column = Math.floor(spot.landing.x + world.player.w / 2)
  return tileAt(world.grid, column, Math.floor(spot.landing.y + spot.landing.h / 2)) === 'ladder'
}

/** Smashes the pane (the loud, shared glass-breaking path) and climbs through. */
export function smashThrough(world: World, spot: WindowSpot): void {
  for (let y = spot.top; y <= spot.bottom; y += 1) smashGlass(world, spot.x, y)
  climbThrough(world, spot)
}

/** Cuts the pane out almost silently and climbs through. */
export function cutThrough(world: World, spot: WindowSpot): void {
  for (let y = spot.top; y <= spot.bottom; y += 1) if (tileAt(world.grid, spot.x, y) === 'glass') hurtTile(world, spot.x, y, Number.MAX_SAFE_INTEGER)
  emitNoise(world, { x: spot.x + 0.5, y: (spot.top + spot.bottom + 1) / 2 }, CUT_NOISE)
  climbThrough(world, spot)
}

/**
 * One short vault through the opening, reusing the ledge climb (so it is drawn as one): up or down to sill height on
 * this side, then across. He lets go of the rope or line first; the hook stays where it bit.
 */
export function climbThrough(world: World, spot: WindowSpot): void {
  const player = world.player
  const grapple = world.grapple
  const toLine = !spot.footing && lineReaches(world, spot)
  if (grapple.phase === 'attached') Object.assign(grapple, { phase: 'parked', hanging: false, reeling: 0 })
  Object.assign(player, { onLadder: false, stairs: null, chute: false, slide: 0 })
  grapple.fling = 0
  player.mantle = startMantle(player, spot.landing, spot.side)
  player.mantle.duration = VAULT_SECONDS
  player.crouching = spot.landing.h < STAND_HEIGHT
  grapple.vault = VAULT_SECONDS
  player.cooldown = Math.max(player.cooldown, VAULT_SECONDS)
  grapple.vaultToLine = toLine
}

/**
 * Reads E at a window as a tap or a hold. `interact.ts` runs the hold (cutting); a release before `TAP_SECONDS`
 * while the window was the action on offer smashes it instead.
 */
export function readWindowTap(world: World, input: Input): void {
  const grapple = world.grapple
  if (input.interactPressed) {
    const offer = grapple.offer
    grapple.tap = offer && world.prompt === offer.prompt ? { key: offer.key, at: world.clock } : null
    return
  }
  const tap = grapple.tap
  if (!tap || input.interact) return
  grapple.tap = null
  if (world.clock - tap.at > TAP_SECONDS || !canWorkWindow(world)) return
  const spot = findWindow(world)
  if (spot && spot.glass && spot.key === tap.key) smashThrough(world, spot)
}

/**
 * A body swinging or flying sideways into glass fast enough, or dropping onto it, goes straight through and is cut a
 * little. `speed` is the velocity he had just before he last moved (the movement itself stops him dead at the pane).
 * Returns true when he went through.
 */
export function crashThrough(world: World, speed: Vec): boolean {
  const player = world.player
  if (player.mantle || player.onLadder || player.stairs) return false
  let broke = false
  if (Math.abs(speed.x) >= CRASH_SPEED) {
    const column = speed.x > 0 ? Math.floor(player.x + player.w + 0.1) : Math.floor(player.x - 0.1)
    for (let row = Math.floor(player.y); row <= Math.floor(player.y + player.h - 0.01); row += 1) if (smashGlass(world, column, row)) broke = true
  }
  if (speed.y >= CRASH_FALL_SPEED) {
    const row = Math.floor(player.y + player.h + 0.1)
    for (const x of [player.x + 0.05, player.x + player.w - 0.05]) if (smashGlass(world, Math.floor(x), row)) broke = true
  }
  if (!broke) return false
  player.hp -= CRASH_HURT
  player.onGround = false
  player.vx = speed.x
  player.vy = speed.y
  return true
}
