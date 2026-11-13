import { describe, expect, it } from 'vitest'
import { createComplex } from '../complex/complex'
import { PROP_KINDS, propSpec } from '../propCatalog'
import type { Level, Prop, Room } from '../site'
import { isSolidAt, TILE_KINDS } from '../tiles'
import { floorSpans } from './space'
import { DESKS, OUTDOOR } from './styles'

const SEEDS = [1, 2, 3, 7, 42]
const levels = new Map(SEEDS.map((seed) => [seed, createComplex(seed)]))
const level = (seed: number) => levels.get(seed)!

const extent = (prop: Prop) => {
  const half = propSpec(prop.kind).w / 2
  return { left: prop.x + 0.5 - half, right: prop.x + 0.5 + half }
}
const mount = (prop: Prop) => propSpec(prop.kind).mount
const isIndoor = (room: Room) => !OUTDOOR.includes(room.kind)
const roomOf = (site: Level, prop: Prop) => site.rooms[prop.roomId!]
const lampsIn = (site: Level, room: Room) =>
  site.lamps.filter((lamp) => lamp.x >= room.x && lamp.x <= room.x + room.w && lamp.y >= room.y && lamp.y <= room.floorY)
const furnished = (site: Level) => site.props.filter((prop) => prop.roomId !== undefined)

const SMALLEST_COVER = Math.min(...PROP_KINDS.filter((kind) => propSpec(kind).mount === 'floor' && propSpec(kind).cover !== 'none').map((kind) => propSpec(kind).w))

/** The widest stretch of a room's furnishable floor with nothing standing on it. */
function widestOpenFloor(site: Level, room: Room): number {
  const standing = site.props.filter((prop) => prop.roomId === room.id && mount(prop) === 'floor' && propSpec(prop.kind).h > 0.1).map(extent)
  let widest = 0
  for (const span of floorSpans(site, room)) {
    let from = span.from
    for (const { left, right } of standing.filter((other) => other.right > span.from && other.left < span.to).sort((a, b) => a.left - b.left)) {
      widest = Math.max(widest, left - from)
      from = Math.max(from, right)
    }
    widest = Math.max(widest, span.to - from)
  }
  return widest
}

describe('furnishSite', () => {
  it('dresses the same seed the same way', () => {
    const [a, b] = [createComplex(9), createComplex(9)]
    expect(a.props).toEqual(b.props)
    expect(a.lamps).toEqual(b.lamps)
    expect(a.devices).toEqual(b.devices)
    expect(a.pickups).toEqual(b.pickups)
  })

  it.each(SEEDS)('seed %i stands floor props on solid floor inside their room, with headroom', (seed) => {
    const site = level(seed)
    for (const prop of furnished(site).filter((p) => mount(p) === 'floor')) {
      const room = roomOf(site, prop)
      const { left, right } = extent(prop)
      const where = `${prop.kind} at ${prop.x} in ${room.kind} ${room.id}`
      expect(prop.y, where).toBe(room.floorY)
      expect(left, where).toBeGreaterThanOrEqual(room.x)
      expect(right, where).toBeLessThanOrEqual(room.x + room.w)
      for (let x = Math.floor(left); x < right; x += 1) {
        expect(isSolidAt(site.grid, x, prop.y), `floor under ${where}`).toBe(true)
        expect(isSolidAt(site.grid, x, prop.y - 1), `space above ${where}`).toBe(false)
      }
    }
  })

  it.each(SEEDS)('seed %i keeps floor props off stair landings, doorways and ladders', (seed) => {
    const site = level(seed)
    for (const prop of furnished(site).filter((p) => mount(p) === 'floor')) {
      const room = roomOf(site, prop)
      const { left, right } = extent(prop)
      const where = `${prop.kind} at ${prop.x} in ${room.kind} ${room.id}`
      expect(left, where).toBeGreaterThanOrEqual(room.x + 1.5)
      expect(right, where).toBeLessThanOrEqual(room.x + room.w - 1.5)
      const landings = site.stairwells.filter((well) => well.stops.includes(room.floorY)).flatMap((well) => [well.leftX, well.rightX])
      for (const x of landings) expect(right <= x - 1.5 || left >= x + 1.5, `${where} by landing ${x}`).toBe(true)
      for (let x = Math.floor(left); x < right; x += 1) {
        for (let y = room.y; y <= room.floorY + 1; y += 1) expect(site.grid.kinds[y * site.grid.width + x], `${where} over a ladder`).not.toBe(7)
      }
    }
  })

  it.each(SEEDS)('seed %i hangs wall and ceiling props inside their room without overlapping', (seed) => {
    const site = level(seed)
    const byRoom = new Map<number, Prop[]>()
    for (const prop of furnished(site)) {
      const room = roomOf(site, prop)
      const { left, right } = extent(prop)
      const where = `${prop.kind} at ${prop.x},${prop.y} in ${room.kind} ${room.id}`
      // Under a duct, ceiling items hang from the duct floor two rows down.
      const underDuct = site.grid.kinds[(room.y + 1) * site.grid.width + Math.floor(prop.x + 0.5)] === TILE_KINDS.indexOf('duct')
      if (mount(prop) === 'ceiling') expect(prop.y, where).toBe(underDuct ? room.y + 2 : room.y)
      if (mount(prop) !== 'wall') continue
      expect(prop.y, where).toBeGreaterThanOrEqual(room.y)
      expect(prop.y + propSpec(prop.kind).h, where).toBeLessThanOrEqual(room.floorY)
      expect(left, where).toBeGreaterThanOrEqual(room.x)
      expect(right, where).toBeLessThanOrEqual(room.x + room.w)
      byRoom.set(room.id, [...(byRoom.get(room.id) ?? []), prop])
    }
    for (const props of byRoom.values()) {
      props.forEach((a, index) => props.slice(index + 1).forEach((b) => {
        const [ea, eb] = [extent(a), extent(b)]
        const apart = ea.right <= eb.left || eb.right <= ea.left || a.y + propSpec(a.kind).h <= b.y || b.y + propSpec(b.kind).h <= a.y
        expect(apart, `${a.kind} and ${b.kind} in room ${a.roomId}`).toBe(true)
      }))
    }
  })

  it.each(SEEDS)('seed %i keeps standing furniture from piling into each other', (seed) => {
    const site = level(seed)
    const standing = furnished(site).filter((p) => mount(p) === 'floor' && propSpec(p.kind).h > 0.1)
    const byRoom = new Map<number, Prop[]>()
    for (const prop of standing) byRoom.set(prop.roomId!, [...(byRoom.get(prop.roomId!) ?? []), prop])
    for (const props of byRoom.values()) {
      const sorted = props.map(extent).sort((a, b) => a.left - b.left)
      sorted.forEach((a, index) => {
        const next = sorted[index + 1]
        if (next) expect(a.right - next.left).toBeLessThanOrEqual(0.4)
      })
    }
  })

  it.each(SEEDS)('seed %i gives every indoor room at least six props and a light', (seed) => {
    const site = level(seed)
    for (const room of site.rooms.filter(isIndoor)) {
      const props = site.props.filter((prop) => prop.roomId === room.id)
      expect(props.length, `${room.kind} ${room.id} (${room.w} wide)`).toBeGreaterThanOrEqual(6)
      expect(lampsIn(site, room).length, `${room.kind} ${room.id}`).toBeGreaterThanOrEqual(1)
    }
  })

  it.each(SEEDS)('seed %i gives every room wider than ten tiles at least two pieces of cover, unless its floor is already full', (seed) => {
    const site = level(seed)
    for (const room of site.rooms.filter((r) => r.w > 10)) {
      const cover = site.props.filter((prop) => prop.roomId === room.id && mount(prop) === 'floor' && propSpec(prop.kind).cover !== 'none')
      if (cover.length >= (room.security >= 2 ? 3 : 2)) continue
      // Too full to add any: no stretch of open floor wide enough for the smallest piece of cover.
      expect(widestOpenFloor(site, room), `${room.kind} ${room.id}`).toBeLessThan(SMALLEST_COVER + 0.2)
    }
  })

  it.each(SEEDS)('seed %i uses the catalogue broadly and stays within sane totals', (seed) => {
    const site = level(seed)
    const kinds = new Set(site.props.map((prop) => prop.kind))
    expect(kinds.size).toBeGreaterThanOrEqual(60)
    expect(site.lamps.length).toBeLessThan(900)
    expect(site.lamps.length).toBeGreaterThan(site.rooms.length * 2)
    expect(site.props.length).toBeGreaterThan(2000)
    expect(site.props.length).toBeLessThan(8000)
    expect(site.pickups.length).toBeGreaterThanOrEqual(12)
    expect(site.pickups.length).toBeLessThanOrEqual(18)
    for (const pickup of site.pickups) expect(isSolidAt(site.grid, pickup.x, pickup.y)).toBe(true)
    for (const kind of ['explosiveBarrel', 'gasCylinder', 'fireExtinguisher', 'sprinkler'] as const) expect(kinds.has(kind), kind).toBe(true)
  })

  it.each(SEEDS)('seed %i lights rooms in layers, on their own circuits, with some failing tubes', (seed) => {
    const site = level(seed)
    expect(site.lamps.some((lamp) => lamp.fixture === 'ceilingPanel' && lamp.strength === 1 && lamp.radius === 9)).toBe(false)
    const fixtures = new Set(site.lamps.map((lamp) => lamp.fixture))
    for (const fixture of ['fluorescentTube', 'deskLamp', 'floorLamp', 'tableLamp', 'wallSconce', 'neon', 'emergency', 'pendant', 'downlight'] as const) {
      expect(fixtures.has(fixture), fixture).toBe(true)
    }
    expect(site.lamps.some((lamp) => lamp.flickers)).toBe(true)
    for (const room of site.rooms.filter((r) => isIndoor(r) && r.building !== 'sewer')) {
      for (const lamp of lampsIn(site, room)) expect(lamp.circuit, `${room.kind} ${room.id}`).toBeDefined()
    }
    for (const lamp of site.lamps) if (lamp.hung) expect(['ceilingPanel', 'fluorescentTube', 'pendant', 'chandelier', 'bareBulb', 'downlight']).toContain(lamp.fixture)
  })

  it.each(SEEDS)('seed %i seats terminals on desks and wires light switches and radios', (seed) => {
    const site = level(seed)
    for (const device of site.devices.filter((d) => d.kind === 'computer')) {
      const desks = site.props.filter((prop) => prop.roomId === device.roomId && DESKS.includes(prop.kind))
      if (desks.length > 0) expect(desks.some((desk) => desk.x === device.x), `computer in room ${device.roomId}`).toBe(true)
    }
    const switches = site.devices.filter((d) => d.kind === 'lightSwitch')
    expect(switches.length).toBeGreaterThan(site.rooms.length / 2)
    for (const device of switches) expect(device.circuit).toBeDefined()
    for (const room of site.rooms.filter((r) => r.kind === 'security')) {
      expect(site.devices.some((d) => d.kind === 'radioRelay' && d.roomId === room.id), `security room ${room.id}`).toBe(true)
    }
  })

  it('does not dress two rooms of the same kind identically', () => {
    const site = level(1)
    const offices = site.rooms.filter((room) => room.kind === 'office')
    // The same pieces can come up in two small rooms; dressed identically means the same pieces in the same places.
    const layouts = offices.map((room) => site.props.filter((p) => p.roomId === room.id && mount(p) === 'floor').map((p) => `${p.kind}@${p.x - room.x}`).join(','))
    expect(new Set(layouts).size).toBe(offices.length)
  })

  it('prints the totals for the report', () => {
    for (const seed of SEEDS) {
      const site = level(seed)
      const floor = site.props.filter((p) => mount(p) === 'floor').length
      console.log(`seed ${seed}: ${site.rooms.length} rooms, ${site.props.length} props (${floor} floor), ${new Set(site.props.map((p) => p.kind)).size} kinds, ${site.lamps.length} lamps, ${site.pickups.length} pickups, ${site.devices.length} devices`)
    }
  })
})
