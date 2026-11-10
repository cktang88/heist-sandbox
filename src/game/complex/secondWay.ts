import { PLACE_ROOMS } from '../intel/places'
import { propSpec } from '../propCatalog'
import { HIDING_KINDS } from '../furnish/hides'
import type { Prop, Room } from '../site'
import { tileAt } from '../tiles'
import { quietWaysInto } from './access'
import { fill, type SiteDraft } from './kit'

/**
 * Every room the case can be kept in gets at least two quiet ways in, so one guarded door is never the only option:
 * a room against the facade gets a window (for a rope or the grapple), any other a maintenance hatch in its floor or
 * ceiling with a ladder from the room below or up to the room above. Runs last, once furniture and ducts are in,
 * so the ladder goes where nothing stands and no duct runs.
 */

const CASE_ROOMS = new Set(Object.values(PLACE_ROOMS).flat())
const NO_LADDER_ROOMS = new Set<Room['kind']>(['stairwell', 'vault', 'elevatorLobby', 'rooftop'])
const WINDOW_ROWS = [2, 3, 4]

export function secondWays(site: SiteDraft): void {
  for (const room of site.rooms) {
    if (!CASE_ROOMS.has(room.kind) || quietWaysInto(site.grid, site.devices, room).length >= 2) continue
    if (!glazeFacade(site, room)) addHatch(site, room)
  }
}

/** A window in the room's outer wall, if it has one above the street. */
function glazeFacade(site: SiteDraft, room: Room): boolean {
  if (room.storey < 1) return false
  for (const wall of [room.x - 1, room.x + room.w]) {
    const beyond = wall < room.x ? wall - 1 : wall + 1
    const outside = !site.rooms.some((other) => other.building === room.building && beyond >= other.x && beyond < other.x + other.w)
      && !site.elevators.some((shaft) => beyond >= shaft.x - 1 && beyond <= shaft.x + shaft.w)
    const solidWall = WINDOW_ROWS.every((up) => ['concrete', 'brick'].includes(tileAt(site.grid, wall, room.floorY - up)))
    if (!outside || !solidWall) continue
    fill(site, wall, room.floorY - 4, wall, room.floorY - 2, 'glass')
    return true
  }
  return false
}

/** Furniture standing over this column in a room (the ladder must stay clear of it). */
function inTheWay(site: SiteDraft, room: Room, x: number): Prop[] {
  return site.props.filter((prop) => prop.roomId === room.id && propSpec(prop.kind).mount === 'floor' && propSpec(prop.kind).h > 0.1
    && Math.abs(prop.x - x) < propSpec(prop.kind).w / 2 + 0.6)
}

/** Light clutter that can be cleared for a ladder (never cover or a hiding place), leaving the room still furnished. */
const MIN_PROPS = 7
function clearable(site: SiteDraft, room: Room, props: Prop[]): boolean {
  const left = site.props.filter((prop) => prop.roomId === room.id).length - props.length
  return left >= MIN_PROPS && props.every((prop) => propSpec(prop.kind).cover === 'none' && !HIDING_KINDS.has(prop.kind))
}

/** The open rows of a room in a column are free for a ladder: no duct, nothing solid. */
function openColumn(site: SiteDraft, room: Room, x: number): boolean {
  for (let y = room.y; y < room.floorY; y += 1) if (tileAt(site.grid, x, y) !== 'air') return false
  return true
}

/** A ceiling fitting of `room` hanging under column `x`, where a hatch is opening: it would hang from the hatch's lid. */
function hangsOver(prop: Prop, room: Room, x: number): boolean {
  const { mount, w } = propSpec(prop.kind)
  return prop.roomId === room.id && mount === 'ceiling' && prop.x + 0.5 - w / 2 < x + 1 && prop.x + 0.5 + w / 2 > x
}

/** A light hung under the new hatch moves along the ceiling, toward the middle of the room, clear of it. */
function clearLampsFrom(site: SiteDraft, room: Room, x: number): void {
  const inward = x + 0.5 < room.x + room.w / 2 ? 1 : -1
  for (const lamp of site.lamps) {
    if (lamp.hung && Math.floor(lamp.x) === x && lamp.y > room.y && lamp.y < room.y + 1.5 && lamp.x >= room.x && lamp.x <= room.x + room.w) lamp.x += inward * 1.5
  }
}

/** A hatch in the slab between `upper` (standing on it) and `lower` (whose ceiling it is), with a ladder down through `lower`. */
function tryHatch(site: SiteDraft, upper: Room, lower: Room, clearing: boolean): boolean {
  const from = Math.max(upper.x, lower.x)
  const to = Math.min(upper.x + upper.w, lower.x + lower.w) - 1
  for (let x = from; x <= to; x += 1) {
    if (!['concrete', 'steel'].includes(tileAt(site.grid, x, upper.floorY)) || !openColumn(site, lower, x)) continue
    const [above, below] = [inTheWay(site, upper, x), inTheWay(site, lower, x)]
    const free = above.length === 0 && below.length === 0
    if (!free && !(clearing && clearable(site, upper, above) && clearable(site, lower, below))) continue
    site.props = site.props.filter((prop) => !above.includes(prop) && !below.includes(prop) && !hangsOver(prop, lower, x))
    clearLampsFrom(site, lower, x)
    fill(site, x, lower.y, x, lower.floorY - 1, 'ladder')
    fill(site, x, upper.floorY, x, upper.floorY, 'door')
    return true
  }
  return false
}

/** Prefers a spot where nothing stands; failing that, clears a piece of clutter out of the way. */
function addHatch(site: SiteDraft, room: Room): boolean {
  const usable = (other: Room) => other.building === room.building && !NO_LADDER_ROOMS.has(other.kind)
  const lower = site.rooms.filter((other) => usable(other) && other.y === room.floorY + 1)
  // A hatch in the roof needs no ladder up on the roof, so a room on the top storey can be got into from up there.
  const upper = site.rooms.filter((other) => (usable(other) || (other.kind === 'rooftop' && other.building === room.building)) && other.floorY === room.y - 1)
  return [false, true].some((clearing) => lower.some((other) => tryHatch(site, room, other, clearing)) || upper.some((other) => tryHatch(site, other, room, clearing)))
}
