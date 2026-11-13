import { randomInt } from '../rng'
import type { Room, RoomKind } from '../site'
import { isSolidAt, setTile, tileAt, type TileKind } from '../tiles'
import { addRoom, chance, circuitOf, fill, pick, ROOM_HEIGHT, STOREY, type SiteDraft } from './kit'

/** A stair lobby (the staircase itself runs up the back of it). `to` may be one above the top storey, meaning the roof. */
export type StairSpec = { x: number; w: number; from: number; to: number }
/**
 * An elevator shaft. Doors open toward `doorSide`. An edge shaft stands against an outside wall; a `central` one stands
 * in the middle of the floors with a reinforced wall on both sides, so each storey it passes is split in two there:
 * the spec must give both halves a staircase on every storey the shaft serves, so guards can still walk everywhere.
 */
export type ShaftSpec = { x: number; w: number; from: number; to: number; doorSide: 1 | -1; central?: boolean }

export type BlockSpec = {
  name: string
  /** Columns of the left and right outside walls. */
  x0: number
  x1: number
  storeys: number
  basements: number
  /** Kinds of room to choose from on a storey. List a kind more than once to make it more likely. */
  plan: (storey: number) => readonly RoomKind[]
  stairs: StairSpec[]
  shafts: ShaftSpec[]
  facade: TileKind
  /** Which outside walls get a street door on the ground floor. */
  doors: (1 | -1)[]
}

/** Rooms tall enough to take out the floor above them. */
const TALL: readonly RoomKind[] = ['lobby', 'cafeteria', 'gym', 'lab', 'server', 'loadingDock', 'garage', 'lounge', 'workshop', 'mechanical']
const BEAM_EVERY = 14
const MIN_ROOM = 8
/**
 * A strip left over beside a staircase or the outer wall is still made a (small) room down to this width:
 * walled off solid instead, it would bury the street door or doorway that opens onto it.
 */
const MIN_LEFTOVER = 6
const MAX_ROOM = 22
/** A run between a central elevator core and a stair lobby at least this wide is split into two rooms. */
const PAIR_WIDTH = 2 * MIN_ROOM + 5
const TALL_ROOM_ODDS = 0.55
/** Rooms that are only what they are above a width: a garage holds a car and a locker. A narrower one is a store room. */
const MIN_WIDTH: Partial<Record<RoomKind, number>> = { garage: 10 }
const fitted = (kind: RoomKind, width: number): RoomKind => (width >= (MIN_WIDTH[kind] ?? 0) ? kind : 'storage')
const OPEN_ARCH_ODDS = 0.3

type Span = { from: number; to: number }
type Zone = Span & { kind: 'stairs' | 'void' | 'shaft' }

/**
 * Raises one building: a reinforced frame that cannot be destroyed (slab ends, beams, shaft walls, basement walls)
 * filled in with destructible floors, partitions, doors and windows, and split into rooms.
 */
export function buildBlock(site: SiteDraft, spec: BlockSpec): void {
  const { x0, x1, storeys, basements } = spec
  const floorY = (storey: number) => site.groundY - storey * STOREY
  const roofY = floorY(storeys)
  const bottomY = floorY(-basements)

  fill(site, x0, roofY, x1, bottomY, 'air')
  for (let storey = -basements; storey <= storeys; storey += 1) {
    const y = floorY(storey)
    fill(site, x0, y, x1, y, 'concrete')
    for (let x = x0; x <= x1; x += BEAM_EVERY) setTile(site.grid, x, y, 'reinforced')
  }
  for (const wall of [x0, x1]) {
    // Outer walls can be blown open anywhere above ground; only the slab ends and the basement walls are indestructible.
    fill(site, wall, roofY - 1, wall, site.groundY - 1, spec.facade)
    fill(site, wall, site.groundY, wall, bottomY, 'reinforced')
    for (let storey = 1; storey <= storeys; storey += 1) setTile(site.grid, wall, floorY(storey), 'reinforced')
  }
  for (const side of spec.doors) fill(site, side === -1 ? x0 : x1, site.groundY - 3, side === -1 ? x0 : x1, site.groundY - 1, 'door')

  site.interiors.push({ kind: 'room', x: x0, y: roofY, w: x1 - x0 + 1, h: bottomY - roofY })

  for (const shaft of spec.shafts) carveShaft(site, spec, shaft, floorY)
  // Shared by the building's staircases and filled in as storeys are laid out: where a void cuts a floor in two.
  const splits: { y: number; from: number; to: number }[] = []
  for (const stair of spec.stairs) {
    const stops: number[] = []
    for (let storey = stair.from; storey <= stair.to; storey += 1) stops.push(floorY(storey))
    site.stairwells.push({
      id: site.stairwells.length, building: spec.name, leftX: stair.x + 1.5, rightX: stair.x + stair.w - 1.5, stops,
      bounds: { x0, x1, streetY: site.groundY, splits },
    })
  }

  // A central shaft cuts each floor it passes, just as a void does: routes on that floor go round by the stairs.
  for (const shaft of spec.shafts.filter((candidate) => candidate.central)) {
    for (let storey = shaft.from; storey <= shaft.to; storey += 1) splits.push({ y: floorY(storey), from: shaft.x - 1, to: shaft.x + shaft.w })
  }
  let voids: Span[] = []
  for (let storey = -basements; storey < storeys; storey += 1) {
    for (const span of voids) splits.push({ y: floorY(storey), from: span.from, to: span.to })
    voids = layOutStorey(site, spec, storey, floorY(storey), voids)
  }
  glaze(site, spec, floorY)
}

/**
 * Puts windows in the outer walls, three rows tall, only where someone can climb through: open room just inside
 * with a floor under it (not a strip walled off solid, a shaft or the void over a double-height room), and no door
 * cutting into the pane.
 */
function glaze(site: SiteDraft, spec: BlockSpec, floorY: (storey: number) => number): void {
  for (const [wall, inside] of [[spec.x0, spec.x0 + 1], [spec.x1, spec.x1 - 1]]) {
    for (let storey = 1; storey < spec.storeys; storey += 1) {
      const y = floorY(storey)
      const pane = chance(site.rng, 0.6)
      const enterable = !isSolidAt(site.grid, inside, y - 2) && isSolidAt(site.grid, inside, y)
      const doorway = [y - 4, y - 3, y - 2].some((row) => tileAt(site.grid, wall, row) === 'door')
      if (pane && enterable && !doorway) fill(site, wall, y - 4, wall, y - 2, 'glass')
    }
  }
}

function carveShaft(site: SiteDraft, spec: BlockSpec, shaft: ShaftSpec, floorY: (storey: number) => number): void {
  const top = floorY(shaft.to) - ROOM_HEIGHT
  const pit = floorY(shaft.from) - 1
  const wallX = shaft.doorSide === 1 ? shaft.x + shaft.w : shaft.x - 1
  fill(site, shaft.x, top, shaft.x + shaft.w - 1, pit, 'air')
  fill(site, wallX, top - 1, wallX, pit + 1, 'reinforced')
  if (shaft.central) {
    const backX = shaft.doorSide === 1 ? shaft.x - 1 : shaft.x + shaft.w
    fill(site, backX, top - 1, backX, pit + 1, 'reinforced')
    fill(site, shaft.x, top - 1, shaft.x + shaft.w - 1, top - 1, 'reinforced')
  }
  const stops: number[] = []
  for (let storey = shaft.from; storey <= shaft.to; storey += 1) {
    fill(site, wallX, floorY(storey) - 3, wallX, floorY(storey) - 1, 'door')
    // A central shaft's back wall has a maintenance door at every stop, onto its service ladder: a second way between
    // floors, and (walking past in front of the shaft, as at any stop) through to the lobby side of the same floor.
    if (shaft.central) fill(site, shaft.doorSide === 1 ? shaft.x - 1 : shaft.x + shaft.w, floorY(storey) - 3, shaft.doorSide === 1 ? shaft.x - 1 : shaft.x + shaft.w, floorY(storey) - 1, 'door')
    stops.push(floorY(storey))
  }
  // A service ladder runs up the far side of every shaft (beside the maintenance doors of a central one).
  const ladderX = shaft.doorSide === 1 ? shaft.x : shaft.x + shaft.w - 1
  fill(site, ladderX, top, ladderX, pit, 'ladder')
  site.elevators.push({ id: site.elevators.length, building: spec.name, x: shaft.x, w: shaft.w, stops, doorSide: shaft.doorSide })
}

/** Splits one storey into rooms. Returns the spans left open above any double-height rooms it made. */
function layOutStorey(site: SiteDraft, spec: BlockSpec, storey: number, floorY: number, voidsHere: Span[]): Span[] {
  const { from: left, to: right } = storeySpan(spec, storey)

  const zones: Zone[] = [
    ...spec.stairs.filter((stair) => storey >= stair.from && storey <= stair.to).map((stair) => ({ from: stair.x, to: stair.x + stair.w - 1, kind: 'stairs' as const })),
    ...voidsHere.map((span) => ({ ...span, kind: 'void' as const })),
    ...centralShafts(spec, storey).map((shaft) => ({ from: shaft.x - 1, to: shaft.x + shaft.w, kind: 'shaft' as const })),
  ].sort((a, b) => a.from - b.from)

  const voidsAbove: Span[] = []
  let madeTall = false
  const kinds = spec.plan(storey)
  const canGoTall = (span: Span) => storey + 1 < spec.storeys && storey >= 0
    && !spec.shafts.some((shaft) => storey + 1 >= shaft.from && storey + 1 <= shaft.to && shaft.x - 2 <= span.to && shaft.x + shaft.w + 1 >= span.from)
    && !spec.stairs.some((stair) => storey + 1 >= stair.from && storey + 1 <= stair.to && stair.x <= span.to + 1 && stair.x + stair.w - 1 >= span.from - 1)
    && upperFloorStaysConnected(spec, storey + 1, span)

  const furnish = (span: Span, halve = false): void => {
    const rooms = splitSpan(site, span, halve)
    rooms.forEach((room, index) => {
      const kind = fitted(pick(site.rng, kinds), room.to - room.from + 1)
      const tall = !madeTall && TALL.includes(kind) && room.to - room.from >= 13 && canGoTall(room) && chance(site.rng, TALL_ROOM_ODDS)
      if (tall) {
        madeTall = true
        fill(site, room.from, floorY - STOREY, room.to, floorY - STOREY, 'air')
        voidsAbove.push(room)
      }
      const made = addRoom(site, kind, spec.name, storey, room.from, room.to, floorY, tall ? ROOM_HEIGHT + STOREY : ROOM_HEIGHT)
      staff(site, made)
      if (index === rooms.length - 1) return
      // Secure rooms keep their doors shut; ordinary ones are sometimes joined by an open archway.
      partition(site, room.to + 1, floorY, made.security < 2 && chance(site.rng, OPEN_ARCH_ODDS) ? 'arch' : 'door')
      if (tall) fill(site, room.to + 1, floorY - STOREY - ROOM_HEIGHT, room.to + 1, floorY - STOREY, 'brick')
    })
  }

  let cursor = left
  zones.forEach((zone, index) => {
    if (zone.kind === 'shaft') {
      // The shaft's own walls bound the rooms either side: no partition to build.
      // Boxed in by the core, a run wide enough for two rooms is split in half: neighbouring rooms keep a duct and a
      // patrol between them, as the long runs of rooms elsewhere do.
      if (zone.from - 1 >= cursor + MIN_LEFTOVER - 1) furnish({ from: cursor, to: zone.from - 1 }, zone.from - cursor >= PAIR_WIDTH)
      else if (zone.from - 1 >= cursor) fill(site, cursor, floorY - ROOM_HEIGHT, zone.from - 1, floorY - 1, spec.facade)
      cursor = zone.to + 1
      return
    }
    if (zone.from - 2 >= cursor + MIN_LEFTOVER - 1) {
      furnish({ from: cursor, to: zone.from - 2 })
      partition(site, zone.from - 1, floorY, zone.kind === 'void' ? 'overlook' : 'door')
    } else if (zone.from - 1 >= cursor) {
      // Too narrow for a room: wall it off solid.
      fill(site, cursor, floorY - ROOM_HEIGHT, zone.from - 1, floorY - 1, spec.facade)
    }
    if (zone.kind === 'stairs') {
      const lobby = addRoom(site, 'stairwell', spec.name, storey, zone.from, zone.to, floorY)
      // Mid-lobby, out of reach of both doorways: by a door it took the E key and the door could not be opened from inside.
      const middle = zone.from + Math.floor((zone.to - zone.from) / 2)
      site.devices.push({ kind: 'fusebox', x: middle, y: floorY - 2, roomId: lobby.id, circuit: circuitOf(spec.name, storey) })
    }
    cursor = zone.to + 2
    // A stair lobby that opens straight onto the void over a double-height room gets an overlook there, not a door
    // that a guard would open and walk out of into the drop.
    const next = zones[index + 1]
    const ontoVoid = zone.kind === 'void' || (next?.kind === 'void' && next.from === zone.to + 2)
    // A central shaft right beside the lobby: its doors are the lobby's wall on that side.
    if (next?.kind === 'shaft' && next.from <= zone.to + 2) return
    if (cursor - 1 <= right) partition(site, zone.to + 1, floorY, ontoVoid ? 'overlook' : 'door')
  })
  if (right >= cursor + MIN_LEFTOVER - 1) furnish({ from: cursor, to: right })
  else if (right >= cursor) fill(site, cursor, floorY - ROOM_HEIGHT, right, floorY - 1, spec.facade)

  return voidsAbove
}

/** The columns a storey's rooms and stair lobbies take up: inside the outer walls and clear of any elevator shaft. */
function storeySpan(spec: BlockSpec, storey: number): Span {
  let from = spec.x0 + 1
  let to = spec.x1 - 1
  for (const shaft of spec.shafts) {
    if (storey < shaft.from || storey > shaft.to || shaft.central) continue
    if (shaft.doorSide === 1) from = Math.max(from, shaft.x + shaft.w + 1)
    else to = Math.min(to, shaft.x - 2)
  }
  return { from, to }
}

/**
 * A double-height room leaves a void in the storey above that splits it in two. Each side must still have a
 * staircase, or be too narrow for a room (and so be walled off); and an elevator stopping there must open onto
 * a side with a staircase, not onto the void or that wall. Otherwise the side is a pocket nobody can walk to.
 */
function upperFloorStaysConnected(spec: BlockSpec, above: number, span: Span): boolean {
  const { from: left, to: right } = storeySpan(spec, above)
  // A central shaft splits the storey: only the part between shafts that holds the void matters.
  let segLeft = left
  let segRight = right
  for (const shaft of centralShafts(spec, above)) {
    if (shaft.x + shaft.w < span.from) segLeft = Math.max(segLeft, shaft.x + shaft.w + 1)
    else if (shaft.x - 1 > span.to) segRight = Math.min(segRight, shaft.x - 2)
    else return false
  }
  const stairs = spec.stairs.filter((stair) => above >= stair.from && above <= stair.to && stair.x >= segLeft && stair.x + stair.w - 1 <= segRight)
  const stairsLeft = stairs.some((stair) => stair.x + stair.w - 1 < span.from)
  const stairsRight = stairs.some((stair) => stair.x > span.to)
  if (!stairsLeft && span.from - segLeft > MIN_LEFTOVER) return false
  if (!stairsRight && segRight - span.to > MIN_LEFTOVER) return false
  return spec.shafts.every((shaft) => {
    if (above < shaft.from || above > shaft.to) return true
    const outside = (shaft.doorSide === 1 ? shaft.x + shaft.w : shaft.x - 1) + shaft.doorSide
    if (outside < segLeft || outside > segRight) return true
    if (outside >= span.from - 1 && outside <= span.to + 1) return false
    return outside < span.from ? stairsLeft : stairsRight
  })
}

/** The central shafts that pass through a storey. */
function centralShafts(spec: BlockSpec, storey: number): ShaftSpec[] {
  return spec.shafts.filter((shaft) => shaft.central && storey >= shaft.from && storey <= shaft.to)
}

/** Cuts a run of floor into rooms of varied width, with a wall and doorway between each pair. */
function splitSpan(site: SiteDraft, span: Span, halve = false): Span[] {
  const rooms: Span[] = []
  let from = span.from
  if (halve && span.to - span.from + 1 <= MAX_ROOM + MIN_ROOM) {
    const middle = span.from + Math.floor((span.to - span.from) / 2)
    return [{ from: span.from, to: middle - 1 }, { from: middle + 1, to: span.to }]
  }
  while (span.to - from + 1 > MAX_ROOM + MIN_ROOM) {
    const width = randomInt(site.rng, MIN_ROOM + 1, MAX_ROOM)
    rooms.push({ from, to: from + width - 1 })
    from += width + 1
  }
  rooms.push({ from, to: span.to })
  return rooms
}

/**
 * Builds the wall between two neighbouring spaces.
 * 'door' has a closed door, 'arch' an open doorway, and 'overlook' is open at the bottom
 * so the upper floor can look and drop into a double-height room.
 */
export function partition(site: SiteDraft, x: number, floorY: number, style: 'door' | 'arch' | 'overlook'): void {
  fill(site, x, floorY - ROOM_HEIGHT, x, floorY - 4, 'brick')
  fill(site, x, floorY - 3, x, floorY - 1, style === 'door' ? 'door' : 'air')
}

/**
 * Posts guards, cameras and terminals in a room according to how secure it is. A security room always has an
 * operator at the monitors (cameras only report when someone is watching); other secure rooms get a post,
 * and ordinary rooms sometimes a guard walking the room end to end.
 */
export function staff(site: SiteDraft, room: Room): void {
  const { rng } = site
  const facing = chance(rng, 0.5) ? 1 : -1
  if (room.kind === 'security') site.guards.push({ x: room.x + 2, y: room.floorY, facing: 1, role: 'operator', roomId: room.id })
  const postOdds = [0.12, 0.35, 0.75, 1][room.security]
  if (room.kind !== 'security' && room.w >= 6 && chance(rng, postOdds)) {
    const x = randomInt(rng, room.x + 2, room.x + room.w - 3)
    if (room.security >= 2) site.guards.push({ x, y: room.floorY, facing, role: 'post', roomId: room.id })
    else site.guards.push({ x, y: room.floorY, facing, role: 'patrol', roomId: room.id, route: [{ x: room.x + 1, y: room.floorY }, { x: room.x + room.w - 2, y: room.floorY }] })
  }
  if (room.security >= 2 || room.kind === 'lobby') {
    site.devices.push({ kind: 'camera', x: room.x + 1, y: room.floorY - 4, roomId: room.id, facing: 1 })
  }
  // Every room with a camera has a terminal on its floor that can switch it off: the guarded rooms keep one of their own.
  if (['office', 'executive', 'security', 'server', 'lab', 'archive', 'lobby', 'armory', 'cells', 'penthouse'].includes(room.kind)) {
    site.devices.push({ kind: 'computer', x: randomInt(rng, room.x + 2, room.x + room.w - 3), y: room.floorY, roomId: room.id })
  }
  if (room.kind === 'security' || room.kind === 'lobby') {
    // Well in from the walls: beside a doorway it took the E key, and the door could not be opened from that side.
    site.devices.push({ kind: 'alarmButton', x: room.x + Math.max(1, room.w - 3), y: room.floorY - 2, roomId: room.id })
  }
}
