import { propSpec } from '../propCatalog'
import type { Prop, Room } from '../site'
import { isSolidAt, setTile, tileAt, type Grid } from '../tiles'
import { chance, pick, ROOM_HEIGHT, type SiteDraft } from './kit'

/**
 * Odds that a storey which can take a duct gets one. Only some storeys can (a duct needs a long enough
 * stretch of rooms with a doorway to rest on), so this keeps the share of all storeys near half.
 */
const DUCT_ODDS = 0.65
const MIN_LENGTH = 20
const MAX_LENGTH = 45
/** Grates sit this many tiles in from each end wall. */
const GRATE_INSET = 2
/** Hung fittings drop this far below the duct floor, the same as below a ceiling. */
const HANG_DROP = 0.2
const OUTDOOR_BUILDINGS = new Set(['grounds', 'sewer', 'silo', 'gatehouse'])
const NO_DUCT_ROOMS = new Set<Room['kind']>(['stairwell', 'vault', 'rooftop', 'elevatorLobby'])

/** A straight duct between two walls: open columns `left..right`, crawled along `crawlY` with its floor on the row below. */
type DuctRun = { left: number; right: number; crawlY: number; rooms: Room[] }

/**
 * Adds crawlable ventilation ducts on many storeys of each building. A duct runs just under the
 * ceiling: the room's top row is the crawl space and the row below it becomes the duct's floor, resting on
 * the walls at both ends and on the doorways it passes over. A grate near each end lets people drop in and out.
 * Ducts stay out of stair lobbies, shafts, double-height rooms and the vault.
 */
export function addDucts(site: SiteDraft): void {
  // Furniture reaching up into the duct's rows (cell bars, a truck) keeps the duct out of its room.
  const tallFurniture = new Set(site.props.filter((prop) => propSpec(prop.kind).mount === 'floor' && propSpec(prop.kind).h > ROOM_HEIGHT - 2).map((prop) => prop.roomId))
  for (const rooms of storeys(site.rooms.filter((room) => !tallFurniture.has(room.id)))) {
    const runs = candidateRuns(site.grid, rooms)
    if (runs.length > 0 && chance(site.rng, DUCT_ODDS)) buildDuct(site, pick(site.rng, runs))
  }
}

/**
 * The row of the duct floor under the ceiling row `roomTopY` at column `x`, or null if no duct runs there.
 * Ceiling fittings in a room with a duct overhead should hang from the duct (at the returned row + 1.2).
 */
export function ductRowAt(grid: Grid, x: number, roomTopY: number): number | null {
  const row = roomTopY + 1
  const column = Math.floor(x)
  if (tileAt(grid, column, row) === 'duct') return row
  const grate = tileAt(grid, column, row) === 'air' && tileAt(grid, column, roomTopY) === 'air'
    && (tileAt(grid, column - 1, row) === 'duct' || tileAt(grid, column + 1, row) === 'duct')
  return grate ? row : null
}

/** Ordinary-height indoor rooms grouped by building and storey, left to right. */
function storeys(rooms: readonly Room[]): Room[][] {
  const groups = new Map<string, Room[]>()
  for (const room of rooms) {
    if (OUTDOOR_BUILDINGS.has(room.building) || NO_DUCT_ROOMS.has(room.kind) || room.h !== ROOM_HEIGHT) continue
    const key = `${room.building}:${room.storey}`
    groups.set(key, [...(groups.get(key) ?? []), room])
  }
  return [...groups.values()].map((group) => group.sort((a, b) => a.x - b.x))
}

/** Every run of side-by-side rooms whose length suits a duct and that the walls can carry. */
function candidateRuns(grid: Grid, rooms: readonly Room[]): DuctRun[] {
  const runs: DuctRun[] = []
  for (let first = 0; first < rooms.length; first += 1) {
    for (let last = first; last < rooms.length; last += 1) {
      if (last > first && !sharesWall(grid, rooms[last - 1], rooms[last])) break
      const run = { left: rooms[first].x, right: rooms[last].x + rooms[last].w - 1, crawlY: rooms[first].y, rooms: rooms.slice(first, last + 1) }
      const length = run.right - run.left + 1
      if (length > MAX_LENGTH) break
      if (length >= MIN_LENGTH && canCarry(grid, run)) runs.push(run)
    }
  }
  return runs
}

/** Neighbours split by one ordinary partition (not a reinforced or steel wall) that a duct can be cut through. */
function sharesWall(grid: Grid, a: Room, b: Room): boolean {
  const wall = a.x + a.w
  return b.x === wall + 1 && tileAt(grid, wall, a.y) === 'brick' && tileAt(grid, wall, a.y + 1) === 'brick'
}

/**
 * The duct floor hangs between the end walls, but the grates cut it there, so the middle stretch must
 * also sit on at least one partition that reaches down to the floor (a door, not an open archway).
 */
function canCarry(grid: Grid, run: DuctRun): boolean {
  const floorY = run.crawlY + 1
  const capped = [run.left - 1, run.right + 1].every((x) => isSolidAt(grid, x, run.crawlY) && isSolidAt(grid, x, floorY))
  const propped = run.rooms.slice(1).some((room) => isSolidAt(grid, room.x - 1, floorY + 1))
  return capped && propped
}

function buildDuct(site: SiteDraft, run: DuctRun): void {
  const floorY = run.crawlY + 1
  for (let x = run.left; x <= run.right; x += 1) {
    setTile(site.grid, x, run.crawlY, 'air')
    setTile(site.grid, x, floorY, 'duct')
  }
  const grates = [run.left + GRATE_INSET, run.right - GRATE_INSET]
  for (const x of grates) setTile(site.grid, x, floorY, 'air')
  rehang(site, run, grates)
  site.props = site.props.filter((prop) => lowerProp(site, run, grates, prop))
}

/** Ceiling lights and wall devices that were up in the new crawl space move down under the duct floor. */
function rehang(site: SiteDraft, run: DuctRun, grates: readonly number[]): void {
  const below = run.crawlY + 2
  const inCrawlSpace = (spot: { x: number; y: number }) => spot.x >= run.left && spot.x < run.right + 1 && spot.y >= run.crawlY && spot.y < below
  for (const lamp of site.lamps) {
    if (!inCrawlSpace(lamp)) continue
    lamp.y = below + HANG_DROP
    // A lamp under a grate would have nothing to hang from.
    if (grates.includes(Math.floor(lamp.x))) lamp.x += lamp.x < (run.left + run.right) / 2 ? 1 : -1
  }
  for (const device of site.devices) {
    if (inCrawlSpace(device)) device.y = below
  }
}

/** Gap left between a lowered wall item and the underside of the duct. */
const WALL_GAP = 0.05

/**
 * Moves a prop of a room under the duct out of the new crawl space: ceiling items hang from the duct floor,
 * wall items slide down below it. Returns false for one that no longer fits (it is dropped): a ceiling item
 * under a grate, or a wall item that would reach the floor or run into another.
 */
function lowerProp(site: SiteDraft, run: DuctRun, grates: readonly number[], prop: Prop): boolean {
  const room = run.rooms.find((candidate) => candidate.id === prop.roomId)
  if (!room) return true
  const below = run.crawlY + 2
  const { w, h, mount } = propSpec(prop.kind)
  const [left, right] = [prop.x + 0.5 - w / 2, prop.x + 0.5 + w / 2]
  if (mount === 'ceiling') {
    prop.y = below
    return !grates.some((x) => x + 1 > left && x < right)
  }
  if (mount !== 'wall' || prop.y >= below) return true
  const top = below + WALL_GAP
  if (top + h > room.floorY - WALL_GAP) return false
  const clashes = site.props.some((other) => other !== prop && other.roomId === room.id && propSpec(other.kind).mount === 'wall'
    && other.y < top + h && top < other.y + propSpec(other.kind).h
    && Math.abs(other.x - prop.x) < (w + propSpec(other.kind).w) / 2)
  if (clashes) return false
  prop.y = top
  return true
}
