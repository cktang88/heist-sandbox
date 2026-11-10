import { propSpec, type PropKind } from '../propCatalog'
import { createRng, type Rng } from '../rng'
import type { Prop, Room, RoomKind } from '../site'
import { isSolidAt, type Grid } from '../tiles'
import { mustStay, placeOnOpenFloor } from './floor'
import { extent } from './pick'
import type { Span } from './space'

/**
 * Places to get out of sight, for the player or for a body: lockers in changing rooms, stair lobbies and staff rooms,
 * closets (wardrobes) in offices and living quarters, stalls in washrooms, cabinets in labs and the infirmary,
 * dumpsters in the yards and at the loading docks. Desks to crawl under are already in every office.
 * Each room gets at least one of its kind, a wide room two, on top of whatever its dressing happened to include.
 */
export const HIDES: Partial<Record<RoomKind, readonly PropKind[]>> = {
  office: ['wardrobe'],
  conference: ['wardrobe'],
  archive: ['wardrobe'],
  executive: ['wardrobe'],
  penthouse: ['wardrobe'],
  barracks: ['wardrobe', 'wallLocker'],
  lockers: ['lockerRow', 'wallLocker'],
  gym: ['lockerRow', 'wallLocker'],
  restroom: ['toiletStall'],
  infirmary: ['medCabinet'],
  lab: ['medCabinet', 'wallLocker'],
  security: ['wallLocker'],
  armory: ['wallLocker'],
  cells: ['wallLocker'],
  server: ['wallLocker'],
  breakRoom: ['wallLocker'],
  kitchen: ['wallLocker'],
  cafeteria: ['wallLocker'],
  lounge: ['wardrobe'],
  janitor: ['wallLocker'],
  mechanical: ['wallLocker'],
  electrical: ['wallLocker'],
  storage: ['wallLocker'],
  workshop: ['wallLocker'],
  garage: ['dumpster', 'wallLocker'],
  loadingDock: ['dumpster'],
  stairwell: ['wallLocker'],
  gatehouse: ['wallLocker'],
  yard: ['dumpster'],
}

export const HIDING_KINDS: ReadonlySet<PropKind> = new Set(Object.values(HIDES).flat())

/** A room this wide gets a second hiding place. */
const WIDE_ROOM = 16

/**
 * Adds hiding places to a room's floor until it has enough of them. The room's own dice, not the furnishing stream,
 * so every other room is dressed exactly as it would be without them.
 */
export function addHides(room: Room, spans: Span[], props: Prop[]): void {
  const kinds = HIDES[room.kind]
  if (!kinds) return
  const rng = createRng(room.x * 7919 + room.floorY * 104729 + room.id)
  const need = room.w > WIDE_ROOM ? 2 : 1
  for (let have = props.filter((prop) => HIDING_KINDS.has(prop.kind)).length; have < need; have += 1) {
    // A narrow locker fits where a wardrobe or a dumpster does not.
    if (!placeOnOpenFloor(rng, room, spans, props, kinds) && !swapIn(room, props, kinds) && !placeOnOpenFloor(rng, room, spans, props, ['wallLocker'])
      && !swapIn(room, props, ['wallLocker']) && !displace(rng, room, spans, props)) return
  }
}

/** Fewest props a finished indoor room has, counting what hangs on its walls and ceiling. */
const MIN_DRESSING = 6
const FILLERS: readonly PropKind[] = ['wallLocker', 'cardboardBoxes', 'bin']

/**
 * A small room that came out bare (a narrow archive of tall shelves, say) gets a locker or some boxes until it has
 * enough in it to read as used. `others` counts what is already on its walls and ceiling.
 */
export function fillOut(grid: Grid, room: Room, spans: Span[], props: Prop[], wall: Prop[], others: number): void {
  if (OUTSIDE.has(room.kind) || room.building === 'sewer') return
  const rng = createRng(room.x * 104729 + room.floorY * 7919 + room.id)
  const count = () => props.length + wall.length + others
  let placed = true
  while (placed && count() < MIN_DRESSING) placed = placeOnOpenFloor(rng, room, spans, props, FILLERS)
  // A floor packed with machines still has wall for a poster or two, clear of the other wall dressing.
  const y = room.floorY - 3
  for (let x = room.x + 1; x < room.x + room.w - 1.5 && count() < MIN_DRESSING; x += 0.5) {
    const span = extent({ kind: 'poster', x })
    const overlaps = wall.some((other) => span.left < extent(other).right + 0.3 && extent(other).left < span.right + 0.3)
    if (!overlaps && !isSolidAt(grid, x + 0.5, y)) wall.push({ kind: 'poster', x, y, roomId: room.id })
  }
}

const OUTSIDE = new Set<RoomKind>(['street', 'yard', 'rooftop'])

/**
 * A room too full to take another piece: one tall piece of furniture at least as wide (a bookshelf, a shelving rack)
 * becomes the hiding place instead, standing where it stood, so the room keeps its cover.
 */
function swapIn(room: Room, props: Prop[], kinds: readonly PropKind[]): boolean {
  for (const kind of kinds) {
    const { w } = propSpec(kind)
    const host = props.find((prop) => propSpec(prop.kind).mount === 'floor' && propSpec(prop.kind).cover === 'high' && propSpec(prop.kind).w >= w
      && !HIDING_KINDS.has(prop.kind) && !mustStay(room, prop, props))
    if (!host) continue
    host.kind = kind
    return true
  }
  return false
}

/** The last resort: a low piece of cover (sandbags, a bench) makes way for a locker, which is cover too. */
function displace(rng: Rng, room: Room, spans: Span[], props: Prop[]): boolean {
  const low = props.filter((prop) => propSpec(prop.kind).mount === 'floor' && propSpec(prop.kind).cover === 'low' && !mustStay(room, prop, props))
  for (const prop of low) {
    const index = props.indexOf(prop)
    props.splice(index, 1)
    if (placeOnOpenFloor(rng, room, spans, props, ['wallLocker'])) return true
    props.splice(index, 0, prop)
  }
  return false
}
