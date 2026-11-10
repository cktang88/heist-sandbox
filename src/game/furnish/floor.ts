import { propSpec, type PropKind } from '../propCatalog'
import type { Rng } from '../rng'
import type { Prop, Room } from '../site'
import { between, extent, hasCover, pickFrom, shuffled, snap } from './pick'
import type { Span } from './space'
import type { Cluster, RoomStyle } from './styles'

type Placed = { kind: PropKind; x: number; flip: boolean }

/** Gap between neighbours in a group: small items tuck in against big ones, big ones sit just apart. */
function spacing(a: PropKind, b: PropKind): number {
  return Math.min(propSpec(a).w, propSpec(b).w) < 1 ? -0.1 : 0.05
}

/** Lays a group out from `cursor`, returning where each piece goes and where the group ends. */
function arrange(cluster: Cluster, cursor: number, flip: boolean): { items: Placed[]; end: number } {
  const order = flip ? [...cluster].reverse() : cluster
  const items: Placed[] = []
  let at = cursor
  order.forEach((kind, index) => {
    const w = propSpec(kind).w
    const x = Math.ceil((at + w / 2 - 0.5) * 4 - 1e-6) / 4
    items.push({ kind, x, flip })
    at = x + 0.5 + w / 2 + (index + 1 < order.length ? spacing(kind, order[index + 1]) : 0)
  })
  return { items, end: at }
}

/** Gap left after a group: usually a step or so, sometimes a wider breathing space. */
function gapAfter(rng: Rng): number {
  return rng() < 0.15 ? between(rng, 1.5, 3) : between(rng, 0.25, 1.4)
}

/** The groups to try, in order: the must-haves, then heroes scattered among medium furniture. */
function buildQueue(rng: Rng, style: RoomStyle, free: number): Cluster[] {
  const heroCount = free < 8 ? 1 : free < 16 ? 2 : 3 + Math.floor(Math.max(0, free - 24) / 16)
  const heroPool = shuffled(rng, style.hero)
  const heroes = Array.from({ length: heroCount }, (_, index) => heroPool[index % heroPool.length])
  const mediums: Cluster[] = []
  for (let index = 0; index < Math.ceil(free / 3); index += 1) {
    let next = pickFrom(rng, style.medium)
    if (next === mediums[mediums.length - 1]) next = pickFrom(rng, style.medium)
    mediums.push(next)
  }
  const queue = [...mediums]
  heroes.forEach((hero, index) => queue.splice(Math.min(queue.length, index * 2 + Math.floor(rng() * 2)), 0, hero))
  return [...(style.must ?? []), ...queue]
}

/**
 * Fills the floor from one end to the other with groups and clutter, leaving gaps between them.
 * Half the rooms are laid out from the right so the same kind of room does not always start the same way.
 */
export function layFloor(rng: Rng, room: Room, spans: Span[], style: RoomStyle): Prop[] {
  const mirror = rng() < 0.5
  const axis = 2 * room.x + room.w
  const work = mirror ? spans.map((span) => ({ from: axis - span.to, to: axis - span.from })).reverse() : spans
  const free = spans.reduce((sum, span) => sum + span.to - span.from, 0)
  const queue = buildQueue(rng, style, free)
  const placed: Placed[] = []
  for (const span of work) {
    let cursor = span.from + rng() * 0.5
    for (;;) {
      const flip = rng() < 0.5
      const index = queue.findIndex((cluster) => arrange(cluster, cursor, flip).end <= span.to)
      if (index >= 0) {
        const { items, end } = arrange(queue[index], cursor, flip)
        placed.push(...items)
        queue.splice(index, 1)
        cursor = end + gapAfter(rng)
        continue
      }
      const fits = style.clutter.filter((kind) => arrange([kind], cursor, flip).end <= span.to)
      // A room never stops short of its first piece, however little floor it has.
      if (fits.length === 0 || (placed.length > 0 && rng() < 0.25)) break
      const { items, end } = arrange([pickFrom(rng, fits)], cursor, flip)
      placed.push(...items)
      cursor = end + gapAfter(rng)
    }
  }
  return placed.map((item) => ({
    kind: item.kind, x: mirror ? axis - item.x - 1 : item.x, y: room.floorY, flip: mirror !== item.flip, roomId: room.id,
  }))
}

function inside(spans: Span[], left: number, right: number): boolean {
  return spans.some((span) => left >= span.from - 1e-6 && right <= span.to + 1e-6)
}

/** Lays a rug under the first seating group, when it fits on clear floor. */
export function layRug(rng: Rng, room: Room, spans: Span[], props: Prop[], odds: number): Prop | null {
  if (rng() >= odds) return null
  const seat = props.find((prop) => ['sofa', 'coffeeTable', 'bed', 'armchair', 'poolTable', 'executiveDesk'].includes(prop.kind))
  if (!seat) return null
  const x = snap(seat.x)
  const { left, right } = extent({ kind: 'rug', x })
  return inside(spans, left, right) ? { kind: 'rug', x, y: room.floorY, roomId: room.id } : null
}

/** Open stretches of floor between the props already standing there. */
function gaps(spans: Span[], props: Prop[]): Span[] {
  const solid = props.filter((prop) => propSpec(prop.kind).h > 0.1).map(extent).sort((a, b) => a.left - b.left)
  return spans.flatMap((span) => {
    const out: Span[] = []
    let from = span.from
    for (const { left, right } of solid) {
      if (right <= from || left >= span.to) continue
      if (left > from) out.push({ from, to: left })
      from = Math.max(from, right)
    }
    if (from < span.to) out.push({ from, to: span.to })
    return out
  })
}

/**
 * Makes sure a wide room has enough to hide behind: adds cover in the open stretch farthest
 * from existing cover, or swaps a piece of furniture for something solid when the floor is full.
 */
export function topUpCover(rng: Rng, room: Room, spans: Span[], props: Prop[], style: RoomStyle, need: number): void {
  for (let have = props.filter(hasCover).length; have < need; have += 1) {
    const kinds = shuffled(rng, style.cover)
    if (!kinds.some((kind) => addInGap(rng, room, spans, props, kind)) && !makeRoom(rng, room, spans, props, kinds)) return
  }
}

/** Puts a piece of cover in the open stretch farthest from other cover. */
function addInGap(rng: Rng, room: Room, spans: Span[], props: Prop[], kind: PropKind): boolean {
  const w = propSpec(kind).w
  const covers = props.filter(hasCover).map((prop) => prop.x + 0.5)
  const distance = (gap: Span) => Math.min(Infinity, ...covers.map((other) => Math.abs(other - (gap.from + gap.to) / 2)))
  const best = gaps(spans, props).filter((gap) => gap.to - gap.from >= w + 0.2).sort((a, b) => distance(b) - distance(a))[0]
  if (!best) return false
  props.push({ kind, x: snap((best.from + best.to) / 2 - 0.5), y: room.floorY, flip: rng() < 0.5, roomId: room.id })
  return true
}

/** When the floor is already full, clears away one piece of light furniture to make space for cover. */
function makeRoom(rng: Rng, room: Room, spans: Span[], props: Prop[], kinds: PropKind[]): boolean {
  const light = props.filter((prop) => !hasCover(prop)).sort((a, b) => propSpec(b.kind).w - propSpec(a.kind).w)
  for (const prop of light) {
    const index = props.indexOf(prop)
    props.splice(index, 1)
    if (kinds.some((kind) => addInGap(rng, room, spans, props, kind))) return true
    props.splice(index, 0, prop)
  }
  return false
}
