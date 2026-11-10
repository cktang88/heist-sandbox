import type { PropState } from '../cover'
import { propSpec } from '../propCatalog'
import { roomAt } from '../site'
import type { Rect, Vec } from '../types'
import type { World } from '../world'
import { currentBuckets, type KeysOf, type PropBuckets } from './buckets'
import { tileKey, type HazardState, type PropIndex } from './state'

/**
 * The box a prop fills, in tiles. A prop's `x` is the tile under its middle; floor props stand on row `y`,
 * wall and ceiling props hang down from row `y`.
 */
export function propBox(prop: PropState): Rect {
  const spec = propSpec(prop.kind)
  const left = prop.x + 0.5 - spec.w / 2
  const top = spec.mount === 'floor' ? prop.y - spec.h : prop.y
  return { x: left, y: top, w: spec.w, h: spec.h }
}

export function propCenter(prop: PropState): Vec {
  const box = propBox(prop)
  return { x: box.x + box.w / 2, y: box.y + box.h / 2 }
}

/** Every tile a prop overlaps (at least one, however thin the prop is). */
export function propTiles(prop: PropState): Vec[] {
  const box = propBox(prop)
  const tiles: Vec[] = []
  const x1 = Math.max(Math.floor(box.x), Math.ceil(box.x + box.w) - 1)
  const y1 = Math.max(Math.floor(box.y), Math.ceil(box.y + box.h) - 1)
  for (let y = Math.floor(box.y); y <= y1; y += 1) for (let x = Math.floor(box.x); x <= x1; x += 1) tiles.push({ x, y })
  return tiles
}

/** Files a prop under every tile it overlaps, as `propTiles` lists them (same box), without making the list. */
function tileKeysOf(world: World): KeysOf {
  return (prop, keys) => {
    const spec = propSpec(prop.kind)
    const left = prop.x + 0.5 - spec.w / 2
    const top = spec.mount === 'floor' ? prop.y - spec.h : prop.y
    const x0 = Math.floor(left)
    const y0 = Math.floor(top)
    const x1 = Math.max(x0, Math.ceil(left + spec.w) - 1)
    const y1 = Math.max(y0, Math.ceil(top + spec.h) - 1)
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) keys.push(tileKey(world, x, y))
  }
}

/**
 * The tile buckets outlive `world.hazards.propIndex`: code that moves a prop clears that field to say "look
 * again" (vehicles/fallingProps.ts), and looking again then means checking which props moved, not rebuilding.
 */
const tileBuckets = new WeakMap<HazardState, PropBuckets>()

/** Brought up to date only if the prop list was replaced, grew or was flagged, and then only for props that moved. */
function propIndex(world: World): PropIndex {
  const cached = world.hazards.propIndex
  if (cached && cached.byTile.props === world.props && cached.byTile.slots.length === world.props.length) return cached
  const byTile = currentBuckets(tileBuckets.get(world.hazards) ?? null, world.props, tileKeysOf(world), cached === null)
  tileBuckets.set(world.hazards, byTile)
  const index = { byTile, sprinklersByRoom: sprinklerRooms(world) }
  world.hazards.propIndex = index
  return index
}

function sprinklerRooms(world: World): Map<number, number[]> {
  const sprinklersByRoom = new Map<number, number[]>()
  for (const prop of world.props) {
    if (prop.kind !== 'sprinkler') continue
    const center = propCenter(prop)
    const room = prop.roomId ?? roomAt(world.rooms, center.x, center.y)?.id
    if (room === undefined) continue
    const list = sprinklersByRoom.get(room)
    if (list) list.push(prop.id)
    else sprinklersByRoom.set(room, [prop.id])
  }
  return sprinklersByRoom
}

const NONE: readonly number[] = []

/** Ids of props covering a tile. */
export function propsAt(world: World, x: number, y: number): readonly number[] {
  return propIndex(world).byTile.byKey.get(tileKey(world, x, y)) ?? NONE
}

export function sprinklersInRoom(world: World, room: number): readonly number[] {
  return propIndex(world).sprinklersByRoom.get(room) ?? NONE
}

export function propById(world: World, id: number): PropState | undefined {
  const prop = world.props[id]
  return prop?.id === id ? prop : world.props.find((other) => other.id === id)
}

/** Props whose middle lies within `radius` of a point. Scans the tiles around it rather than every prop. */
export function propsNear(world: World, at: Vec, radius: number): PropState[] {
  const found = new Set<number>()
  const reach = Math.ceil(radius) + 1
  for (let y = Math.floor(at.y) - reach; y <= Math.floor(at.y) + reach; y += 1) {
    for (let x = Math.floor(at.x) - reach; x <= Math.floor(at.x) + reach; x += 1) for (const id of propsAt(world, x, y)) found.add(id)
  }
  const props: PropState[] = []
  for (const id of found) {
    const prop = propById(world, id)
    if (!prop) continue
    const center = propCenter(prop)
    if (Math.hypot(center.x - at.x, center.y - at.y) <= radius) props.push(prop)
  }
  return props
}
