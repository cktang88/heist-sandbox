import { propSpec, type PropKind } from '../propCatalog'
import type { Rng } from '../rng'
import type { Prop, Room } from '../site'
import { isSolidAt, type Grid } from '../tiles'
import { between, extent, pickFrom } from './pick'
import { ABOVE, type RoomStyle } from './styles'

/** A rectangle on the back wall, in tiles, `top` being the smaller y. */
export type WallRect = { left: number; right: number; top: number; bottom: number }

/** How high each wall item hangs: tucked under the ceiling, up high, at eye level, by the hand, or standing on the floor. */
type Band = 'top' | 'high' | 'eye' | 'low' | 'floor'
const BAND: Partial<Record<PropKind, Band>> = {
  pipeRun: 'top', conduitRun: 'top',
  ventGrille: 'high', wallAc: 'high', exitSign: 'high', roomNumber: 'high', neonSign: 'high', logoSign: 'high', billboard: 'high', wallClock: 'high',
  lightSwitch: 'low', fireExtinguisher: 'low', fireAlarmPull: 'low', intercom: 'low', hazardStripe: 'low', keyBox: 'low',
  fireplace: 'floor', depositBoxes: 'floor',
}

const MIN_WALL_ITEMS = 4
/** Floor and wall pieces together that keep even a small room from looking bare. */
const MIN_DRESSING = 6
const SERVICE_RUNS: readonly PropKind[] = ['conduitRun', 'ventGrille', 'roomNumber', 'pipeRun', 'exitSign', 'fireExtinguisher', 'wallClock']

const overlaps =(a: WallRect, b: WallRect, pad: number) =>
  a.left < b.right + pad && b.left < a.right + pad && a.top < b.bottom + pad && b.top < a.bottom + pad

/** Row of an item's top edge for its band. `eyeLine` is shared by the room so posters and boards line up. */
function bandTop(rng: Rng, room: Room, kind: PropKind, eyeLine: number): number {
  const h = propSpec(kind).h
  switch (BAND[kind] ?? 'eye') {
    case 'top': return room.y + between(rng, 0.05, 0.3)
    case 'high': return room.y + between(rng, 0.35, 0.9)
    case 'low': return room.floorY - 1.3 - h / 2 + between(rng, -0.1, 0.1)
    case 'floor': return room.floorY - h
    case 'eye': return eyeLine - h / 2 + between(rng, -0.12, 0.12)
  }
}

/** Picks up to `count` kinds from a weighted pool, without letting any one kind take over. */
function choose(rng: Rng, pool: readonly PropKind[], count: number, limit: number): PropKind[] {
  const used = new Map<PropKind, number>()
  const out: PropKind[] = []
  for (let tries = 0; out.length < count && tries < count * 4; tries += 1) {
    const kind = pickFrom(rng, pool)
    if ((used.get(kind) ?? 0) >= limit) continue
    used.set(kind, (used.get(kind) ?? 0) + 1)
    out.push(kind)
  }
  return out.sort((a, b) => propSpec(b).w - propSpec(a).w)
}

type Hanger = { grid: Grid; room: Room; floor: Prop[]; taken: WallRect[] }

/** Is this spot free: open air behind it, nothing else hanging there, and not hidden behind tall furniture? */
function spotFree(hanger: Hanger, rect: WallRect, band: Band): boolean {
  const { grid, room, floor, taken } = hanger
  if (rect.top < room.y - 1e-6 || rect.bottom > room.floorY + 1e-6) return false
  if (taken.some((other) => overlaps(rect, other, 0.15))) return false
  for (let y = Math.floor(rect.top); y < rect.bottom; y += 1) {
    for (let x = Math.floor(rect.left); x < rect.right; x += 1) if (isSolidAt(grid, x, y)) return false
  }
  if (band === 'top') return true
  return floor.every((prop) => {
    const h = propSpec(prop.kind).h
    const { left, right } = extent(prop)
    return h < 0.1 || right <= rect.left || left >= rect.right || rect.bottom <= room.floorY - h - 0.1
  })
}

/** Tries a handful of spots along the wall for one item. */
function hang(rng: Rng, hanger: Hanger, kind: PropKind, top: () => number): Prop | null {
  const { room } = hanger
  const { w, h } = propSpec(kind)
  if (w > room.w - 0.2) return null
  for (let tries = 0; tries < 16; tries += 1) {
    const centre = between(rng, room.x + w / 2 + 0.1, room.x + room.w - w / 2 - 0.1)
    const y = Math.round(top() * 20) / 20
    const rect = { left: centre - w / 2, right: centre + w / 2, top: y, bottom: y + h }
    if (!spotFree(hanger, rect, BAND[kind] ?? 'eye')) continue
    hanger.taken.push(rect)
    return { kind, x: Math.round((centre - 0.5) * 20) / 20, y, flip: rng() < 0.5, roomId: room.id }
  }
  return null
}

/**
 * Dresses the back wall: posters, boards, vents, pipes and safety kit, kept clear of each other,
 * of devices already mounted there, and of tall furniture standing in front.
 * A double-height room also gets big items high up.
 */
export function hangWall(rng: Rng, grid: Grid, room: Room, style: RoomStyle, floor: Prop[], reserved: WallRect[]): Prop[] {
  if (style.wall.length === 0) return []
  const hanger: Hanger = { grid, room, floor, taken: [...reserved] }
  const eyeLine = room.floorY - 2.5 + between(rng, -0.2, 0.2)
  const count = Math.max(6, Math.round(room.w / 2.2) + 1)
  const limit = Math.max(2, Math.ceil(room.w / 12))
  const out: Prop[] = []
  for (const kind of choose(rng, style.wall, count, limit)) {
    const prop = hang(rng, hanger, kind, () => bandTop(rng, room, kind, eyeLine))
    if (prop) out.push(prop)
  }
  // A cramped room whose wall is hidden behind furniture (or with little floor to furnish) still gets its services.
  for (const kind of SERVICE_RUNS) {
    if (out.length >= MIN_WALL_ITEMS && out.length + floor.length >= MIN_DRESSING) break
    const prop = hang(rng, hanger, kind, () => bandTop(rng, room, kind, eyeLine))
    if (prop) out.push(prop)
  }
  if (room.h > 6 && style.tall) {
    for (const kind of choose(rng, style.tall, Math.round(room.w / 4), limit)) {
      const h = propSpec(kind).h
      const prop = hang(rng, hanger, kind, () => room.y + between(rng, 0.3, Math.max(0.3, room.floorY - 6 - h - room.y)))
      if (prop) out.push(prop)
    }
  }
  return out
}

/** Dresses the ceiling: hoods and projectors over what they serve, then ducts, cables, sprinklers and detectors. */
export function hangCeiling(rng: Rng, grid: Grid, room: Room, style: RoomStyle, floor: Prop[]): Prop[] {
  const out: Prop[] = []
  const taken: { left: number; right: number }[] = []
  // Nothing hangs under a hole in the ceiling, such as a manhole a ladder comes down through.
  const hole = (span: { left: number; right: number }) => {
    for (let x = Math.floor(span.left); x < span.right; x += 1) if (!isSolidAt(grid, x, room.y - 1)) return true
    return false
  }
  for (const prop of floor) {
    const kind = ABOVE[prop.kind]
    if (!kind || hole(extent({ kind, x: prop.x }))) continue
    out.push({ kind, x: prop.x, y: room.y, roomId: room.id })
    taken.push(extent({ kind, x: prop.x }))
  }
  if (style.ceiling.length === 0) return out
  const count = Math.max(3, Math.round(room.w / 4) + 1)
  for (const kind of choose(rng, style.ceiling, count, Math.max(2, Math.ceil(room.w / 10)))) {
    const w = propSpec(kind).w
    if (w > room.w - 0.4) continue
    for (let tries = 0; tries < 12; tries += 1) {
      const centre = between(rng, room.x + w / 2 + 0.2, room.x + room.w - w / 2 - 0.2)
      const span = { left: centre - w / 2, right: centre + w / 2 }
      if (hole(span) || taken.some((other) => span.left < other.right + 0.3 && other.left < span.right + 0.3)) continue
      taken.push(span)
      out.push({ kind, x: Math.round((centre - 0.5) * 20) / 20, y: room.y, flip: rng() < 0.5, roomId: room.id })
      break
    }
  }
  return out
}
