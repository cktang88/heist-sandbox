import { circuitOf, type SiteDraft } from '../complex/kit'
import { createRng, type Rng } from '../rng'
import type { Room } from '../site'
import { addLightSwitch, addPickups, deviceRects, seatDevices } from './fittings'
import { layFloor, layRug, topUpCover } from './floor'
import { lightRoom } from './lamps'
import { ROOM_LIGHTING } from './lighting'
import { floorSpans, type Span } from './space'
import { OUTDOOR, ROOM_STYLES } from './styles'
import { hangCeiling, hangWall } from './walls'

/** Rooms with no doorway of their own to put a light switch by. */
const NO_SWITCH = new Set(['sewer', 'silo', ...OUTDOOR])

/** Pieces of cover a room wider than this needs, so someone crossing it has somewhere to stop. */
const OPEN_ROOM = 10
function coverNeeded(room: Room): number {
  if (room.w <= OPEN_ROOM) return 0
  return 2 + (room.security >= 2 ? 1 : 0) + (room.security === 3 ? 1 : 0)
}

/**
 * Fills every room with furniture, wall and ceiling dressing, layered lighting, light switches
 * and supplies to suit what the room is for. Replaces the plain ceiling panels each room started with.
 */
export function furnishSite(site: SiteDraft): void {
  // A private stream, seeded once, so changing how rooms are dressed never reshuffles the rest of the site.
  const rng = createRng(Math.floor(site.rng() * 2 ** 32))
  removePlainPanels(site)
  const floors = new Map<Room, Span[]>()
  for (const room of site.rooms) floors.set(room, furnishRoom(rng, site, room))
  addPickups(rng, site, floors)
}

/** Dresses one room. Returns its open floor, for supplies to be dropped on. */
function furnishRoom(rng: Rng, site: SiteDraft, room: Room): Span[] {
  const style = ROOM_STYLES[room.kind]
  const outdoor = OUTDOOR.includes(room.kind)
  const circuit = circuitOf(room.building, room.storey)
  const spans = floorSpans(site, room)

  const floor = layFloor(rng, room, spans, style)
  topUpCover(rng, room, spans, floor, style, coverNeeded(room))
  const rug = style.rug ? layRug(rng, room, spans, floor, style.rug) : null

  if (!NO_SWITCH.has(room.kind)) addLightSwitch(rng, site, room, circuit)
  const wall = hangWall(rng, site.grid, room, style, floor, deviceRects(site, room))
  const ceiling = hangCeiling(rng, site.grid, room, style, floor)
  seatDevices(site, room, floor)

  site.props.push(...(rug ? [rug] : []), ...floor, ...wall, ...ceiling)
  site.lamps.push(...lightRoom(rng, room, ROOM_LIGHTING[room.kind], [...floor, ...wall], outdoor ? undefined : circuit))
  return spans
}

/** Drops the stand-in ceiling panels that every room was given when it was laid out. */
function removePlainPanels(site: SiteDraft): void {
  site.lamps = site.lamps.filter((lamp) => !site.rooms.some((room) =>
    lamp.fixture === 'ceilingPanel' && Math.abs(lamp.y - (room.y + 0.2)) < 0.01 && lamp.x >= room.x && lamp.x <= room.x + room.w))
}
