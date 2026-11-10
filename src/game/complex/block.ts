import { randomInt } from '../rng'
import type { Room, RoomKind } from '../site'
import { setTile, type TileKind } from '../tiles'
import { addRoom, chance, circuitOf, fill, pick, ROOM_HEIGHT, STOREY, type SiteDraft } from './kit'

/** A stair lobby (the staircase itself runs up the back of it). `to` may be one above the top storey, meaning the roof. */
export type StairSpec = { x: number; w: number; from: number; to: number }
/** An elevator shaft against an outside wall. Doors open toward `doorSide`. */
export type ShaftSpec = { x: number; w: number; from: number; to: number; doorSide: 1 | -1 }

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
const MAX_ROOM = 22
const TALL_ROOM_ODDS = 0.55
const OPEN_ARCH_ODDS = 0.3

type Span = { from: number; to: number }
type Zone = Span & { kind: 'stairs' | 'void' }

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
    for (let storey = 1; storey < storeys; storey += 1) {
      fill(site, wall, floorY(storey) - 4, wall, floorY(storey) - 2, chance(site.rng, 0.6) ? 'glass' : spec.facade)
    }
  }
  for (const side of spec.doors) fill(site, side === -1 ? x0 : x1, site.groundY - 3, side === -1 ? x0 : x1, site.groundY - 1, 'door')

  site.interiors.push({ kind: 'room', x: x0, y: roofY, w: x1 - x0 + 1, h: bottomY - roofY })

  for (const shaft of spec.shafts) carveShaft(site, spec, shaft, floorY)
  for (const stair of spec.stairs) {
    const stops: number[] = []
    for (let storey = stair.from; storey <= stair.to; storey += 1) stops.push(floorY(storey))
    site.stairwells.push({ id: site.stairwells.length, building: spec.name, leftX: stair.x + 1.5, rightX: stair.x + stair.w - 1.5, stops })
  }

  let voids: Span[] = []
  for (let storey = -basements; storey < storeys; storey += 1) {
    voids = layOutStorey(site, spec, storey, floorY(storey), voids)
  }
}

function carveShaft(site: SiteDraft, spec: BlockSpec, shaft: ShaftSpec, floorY: (storey: number) => number): void {
  const top = floorY(shaft.to) - ROOM_HEIGHT
  const pit = floorY(shaft.from) - 1
  const wallX = shaft.doorSide === 1 ? shaft.x + shaft.w : shaft.x - 1
  fill(site, shaft.x, top, shaft.x + shaft.w - 1, pit, 'air')
  fill(site, wallX, top - 1, wallX, pit + 1, 'reinforced')
  const stops: number[] = []
  for (let storey = shaft.from; storey <= shaft.to; storey += 1) {
    fill(site, wallX, floorY(storey) - 3, wallX, floorY(storey) - 1, 'door')
    stops.push(floorY(storey))
  }
  // A service ladder runs up the far side of every shaft.
  const ladderX = shaft.doorSide === 1 ? shaft.x : shaft.x + shaft.w - 1
  fill(site, ladderX, top, ladderX, pit, 'ladder')
  site.elevators.push({ id: site.elevators.length, building: spec.name, x: shaft.x, w: shaft.w, stops, doorSide: shaft.doorSide })
}

/** Splits one storey into rooms. Returns the spans left open above any double-height rooms it made. */
function layOutStorey(site: SiteDraft, spec: BlockSpec, storey: number, floorY: number, voidsHere: Span[]): Span[] {
  let left = spec.x0 + 1
  let right = spec.x1 - 1
  for (const shaft of spec.shafts) {
    if (storey < shaft.from || storey > shaft.to) continue
    if (shaft.doorSide === 1) left = Math.max(left, shaft.x + shaft.w + 1)
    else right = Math.min(right, shaft.x - 2)
  }

  const zones: Zone[] = [
    ...spec.stairs.filter((stair) => storey >= stair.from && storey <= stair.to).map((stair) => ({ from: stair.x, to: stair.x + stair.w - 1, kind: 'stairs' as const })),
    ...voidsHere.map((span) => ({ ...span, kind: 'void' as const })),
  ].sort((a, b) => a.from - b.from)

  const voidsAbove: Span[] = []
  let madeTall = false
  const kinds = spec.plan(storey)
  const canGoTall = (span: Span) => storey + 1 < spec.storeys && storey >= 0
    && !spec.stairs.some((stair) => storey + 1 >= stair.from && storey + 1 <= stair.to && stair.x <= span.to + 1 && stair.x + stair.w - 1 >= span.from - 1)

  const furnish = (span: Span): void => {
    const rooms = splitSpan(site, span)
    rooms.forEach((room, index) => {
      const kind = pick(site.rng, kinds)
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
  for (const zone of zones) {
    if (zone.from - 2 >= cursor + MIN_ROOM - 1) {
      furnish({ from: cursor, to: zone.from - 2 })
      partition(site, zone.from - 1, floorY, zone.kind === 'void' ? 'overlook' : 'door')
    } else if (zone.from - 1 >= cursor) {
      // Too narrow for a room: wall it off solid.
      fill(site, cursor, floorY - ROOM_HEIGHT, zone.from - 1, floorY - 1, spec.facade)
    }
    if (zone.kind === 'stairs') {
      const lobby = addRoom(site, 'stairwell', spec.name, storey, zone.from, zone.to, floorY)
      site.devices.push({ kind: 'fusebox', x: zone.from + 1, y: floorY - 2, roomId: lobby.id, circuit: circuitOf(spec.name, storey) })
    }
    cursor = zone.to + 2
    if (cursor - 1 <= right) partition(site, zone.to + 1, floorY, zone.kind === 'void' ? 'overlook' : 'door')
  }
  if (right >= cursor + MIN_ROOM - 1) furnish({ from: cursor, to: right })
  else if (right >= cursor) fill(site, cursor, floorY - ROOM_HEIGHT, right, floorY - 1, spec.facade)

  return voidsAbove
}

/** Cuts a run of floor into rooms of varied width, with a wall and doorway between each pair. */
function splitSpan(site: SiteDraft, span: Span): Span[] {
  const rooms: Span[] = []
  let from = span.from
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
function staff(site: SiteDraft, room: Room): void {
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
  if (['office', 'executive', 'security', 'server', 'lab', 'archive'].includes(room.kind)) {
    site.devices.push({ kind: 'computer', x: randomInt(rng, room.x + 2, room.x + room.w - 3), y: room.floorY, roomId: room.id })
  }
  if (room.kind === 'security' || room.kind === 'lobby') {
    site.devices.push({ kind: 'alarmButton', x: room.x + room.w - 2, y: room.floorY - 2, roomId: room.id })
  }
}
