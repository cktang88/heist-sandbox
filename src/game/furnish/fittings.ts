import type { Rng } from '../rng'
import type { PickupSpawn, Prop, Room, RoomKind } from '../site'
import type { SiteDraft } from '../complex/kit'
import { pickFrom, shuffled } from './pick'
import { doorwaySides, type Span } from './space'
import { DESKS } from './styles'
import type { WallRect } from './walls'

/** Supplies each kind of room may hold, most likely first. */
const SUPPLIES: Partial<Record<RoomKind, readonly PickupSpawn['kind'][]>> = {
  infirmary: ['medkit', 'medkit'], armory: ['ammo', 'ammo'], security: ['ammo', 'medkit'], lockers: ['medkit'],
  barracks: ['ammo'], gatehouse: ['ammo'], breakRoom: ['medkit'], workshop: ['medkit'],
}
const PICKUPS_MIN = 13
const PICKUPS_MAX = 17

/** Wall-mounted devices in a room, as rectangles wall props must keep off. */
export function deviceRects(site: SiteDraft, room: Room): WallRect[] {
  return site.devices
    .filter((device) => device.roomId === room.id && device.y < room.floorY)
    .map((device) => ({ left: device.x, right: device.x + 1, top: device.y, bottom: device.y + 1 }))
}

/** A light switch on the wall just inside a doorway, wired to the room's lights. */
export function addLightSwitch(rng: Rng, site: SiteDraft, room: Room, circuit: number): void {
  const sides = doorwaySides(site, room)
  if (sides.length === 0) return
  const side = pickFrom(rng, sides)
  const x = side === -1 ? room.x : room.x + room.w - 1
  const y = room.floorY - 2
  if (site.devices.some((device) => device.x === x && device.y === y)) return
  site.devices.push({ kind: 'lightSwitch', x, y, roomId: room.id, circuit })
}

/** Sits the room's terminal on a desk, and the security room's radio relay on its radio set. */
export function seatDevices(site: SiteDraft, room: Room, floor: Prop[]): void {
  const desks = floor.filter((prop) => DESKS.includes(prop.kind))
  for (const device of site.devices) {
    if (device.kind !== 'computer' || device.roomId !== room.id || desks.length === 0) continue
    const nearest = desks.reduce((best, desk) => (Math.abs(desk.x - device.x) < Math.abs(best.x - device.x) ? desk : best))
    device.x = nearest.x
  }
  if (room.kind !== 'security') return
  const radio = floor.find((prop) => prop.kind === 'radioStation')
  site.devices.push(radio
    ? { kind: 'radioRelay', x: radio.x, y: room.floorY, roomId: room.id }
    : { kind: 'radioRelay', x: room.x + Math.floor(room.w / 2), y: room.floorY - 2, roomId: room.id })
}

/** Scatters medkits and ammo through the rooms that would stock them. */
export function addPickups(rng: Rng, site: SiteDraft, floors: Map<Room, Span[]>): void {
  const offers = shuffled(rng, [...floors.entries()].flatMap(([room, spans]) => (SUPPLIES[room.kind] ?? []).map((kind, rank) => ({ room, spans, kind, rank }))))
    .sort((a, b) => a.rank - b.rank)
  const target = PICKUPS_MIN + Math.floor(rng() * (PICKUPS_MAX - PICKUPS_MIN + 1))
  for (const { room, spans, kind } of offers) {
    if (site.pickups.length >= target) return
    const columns = spans.flatMap((span) => {
      const out: number[] = []
      for (let x = Math.ceil(span.from); x + 1 <= span.to; x += 1) out.push(x)
      return out
    })
    if (columns.length > 0) site.pickups.push({ kind, x: pickFrom(rng, columns), y: room.floorY })
  }
}
