import { TILE_DEFS, TILE_KINDS } from '../tiles'
import type { World } from '../world'
import type { LiquidField, LiquidKind } from './state'

/**
 * Water and fuel as shallow layers on floors. A cell is an open tile with its depth in tiles; it evens out with its
 * neighbours along the floor, pours over edges and through holes to the next floor down, runs down stairwells (the
 * stair flights are in the back lane, so the slab under a stair lobby holds water only for a moment), and thin
 * films stop spreading, so a burst pipe makes a puddle, not a film over the whole storey. Walls and closed doors
 * hold it, so a sealed room or basement slowly fills. Ticked a few times a second, only where liquid lies.
 */
export const MAX_LIQUID_CELLS = 2500
/** A room full to the ceiling. */
export const MAX_DEPTH = 5
const SHARE = 0.4
/** Flow passes per tick: water runs several tiles a second, which one pass at a few ticks a second cannot do. */
const PASSES = 4
/** A film thinner than this stays put (surface tension and the floor soaking it up). */
const MIN_SPREAD = 0.03
const EDGE_SHARE = 0.35
const STAIR_SHARE = 0.4
const EMPTY = 0.004
/** Depth lost per second to drains, cracks and soaking in; fuel soaks in slower. */
const DRAIN = { water: 0.004, fuel: 0.002 }
const FALL_SCAN = 80

const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))

export function liquidField(world: World, kind: LiquidKind): LiquidField {
  const systems = world.systems
  const size = world.grid.width * world.grid.height
  const existing = systems[kind]
  if (existing && existing.size === size) return existing
  const made: LiquidField = { kind, size, depth: new Float32Array(size), flow: new Float32Array(size), live: new Uint8Array(size), active: [], falls: [] }
  systems[kind] = made
  return made
}

export function hasLiquid(world: World, kind: LiquidKind): boolean {
  const field = world.systems[kind]
  return !!field && field.active.length > 0 && field.size === world.grid.width * world.grid.height
}

function solidKey(world: World, key: number): boolean {
  return key < 0 || key >= world.grid.kinds.length || SOLID[world.grid.kinds[key]] === 1
}

/** Depth at a tile, 0 if dry. */
export function liquidAt(world: World, kind: LiquidKind, x: number, y: number): number {
  const field = world.systems[kind]
  const { width, height } = world.grid
  if (!field || x < 0 || y < 0 || x >= width || y >= height || field.size !== width * height) return 0
  return field.depth[y * width + x]
}

function activate(field: LiquidField, key: number): boolean {
  if (field.live[key]) return true
  if (field.active.length >= MAX_LIQUID_CELLS) return false
  field.live[key] = 1
  field.active.push(key)
  return true
}

/**
 * The tile liquid released at a spot comes to rest on: straight down to the first tile with a floor under it.
 * -1 if it would leave the map.
 */
export function restingKey(world: World, x: number, y: number): number {
  const { width, height } = world.grid
  const tx = Math.floor(x)
  let ty = Math.floor(y)
  if (tx < 0 || tx >= width || ty < 0 || ty >= height) return -1
  if (solidKey(world, ty * width + tx)) ty -= 1
  for (let scanned = 0; ty >= 0 && ty < height - 1 && scanned < FALL_SCAN; scanned += 1, ty += 1) {
    const key = ty * width + tx
    if (solidKey(world, key)) return -1
    if (solidKey(world, key + width)) return key
  }
  return -1
}

/** Pours liquid in at a spot. It drops to the floor below first; the drop is remembered as a stream for drawing. */
export function pourLiquid(world: World, kind: LiquidKind, x: number, y: number, amount: number): number {
  const key = restingKey(world, x, y)
  if (key < 0) return -1
  const field = liquidField(world, kind)
  if (!activate(field, key)) return -1
  field.depth[key] = Math.min(MAX_DEPTH, field.depth[key] + amount)
  const width = world.grid.width
  const bottom = (key - (key % width)) / width
  if (bottom - Math.floor(y) >= 1) noteFall(field, Math.floor(x), Math.floor(y), bottom, amount)
  return key
}

/** Takes up to `amount` of liquid out of a tile (burnt fuel, water boiled off). */
export function takeLiquid(world: World, kind: LiquidKind, key: number, amount: number): void {
  const field = world.systems[kind]
  if (!field || key < 0 || key >= field.size) return
  field.depth[key] = Math.max(0, field.depth[key] - amount)
}

function noteFall(field: LiquidField, x: number, top: number, bottom: number, amount: number): void {
  const existing = field.falls.find((fall) => fall.x === x && fall.top === top)
  if (existing) existing.amount += amount
  else if (field.falls.length < 64) field.falls.push({ x, top, bottom, amount, kind: field.kind })
}

/** Stair lobbies by the floor row they stand on: their open columns and the floor row of the lobby below. */
type StairDrop = { from: number; to: number; belowY: number }
const stairCache = new WeakMap<object, Map<number, StairDrop[]>>()

function stairDrops(world: World): Map<number, StairDrop[]> {
  const cached = stairCache.get(world.rooms)
  if (cached) return cached
  const drops = new Map<number, StairDrop[]>()
  for (const room of world.rooms) {
    if (room.kind !== 'stairwell') continue
    const below = world.rooms.find((other) => other.kind === 'stairwell' && other.building === room.building && other.floorY > room.floorY
      && other.floorY <= room.floorY + 8 && other.x < room.x + room.w && other.x + other.w > room.x)
    if (!below) continue
    const list = drops.get(room.floorY) ?? []
    list.push({ from: Math.max(room.x, below.x), to: Math.min(room.x + room.w, below.x + below.w) - 1, belowY: below.floorY })
    drops.set(room.floorY, list)
  }
  stairCache.set(world.rooms, drops)
  return drops
}

function stairBelow(world: World, x: number, floorRow: number): number {
  const list = stairDrops(world).get(floorRow)
  if (!list) return -1
  for (const drop of list) if (x >= drop.from && x <= drop.to) return drop.belowY
  return -1
}

/** One liquid tick. Flows are worked out from this tick's depths, then applied, so the order of cells does not matter. */
export function stepLiquid(world: World, kind: LiquidKind, tick: number): void {
  const field = world.systems[kind]
  if (!field || field.size !== world.grid.width * world.grid.height) return
  field.falls.length = 0
  for (let pass = 0; pass < PASSES && field.active.length > 0; pass += 1) {
    const count = field.active.length
    for (let index = 0; index < count; index += 1) flowFrom(world, field, field.active[index])
    settle(world, field, tick / PASSES)
  }
}

function move(field: LiquidField, from: number, to: number, amount: number): void {
  if (amount <= 0 || !activate(field, to)) return
  field.flow[from] -= amount
  field.flow[to] += amount
}

function flowFrom(world: World, field: LiquidField, key: number): void {
  const width = world.grid.width
  const depth = field.depth[key]
  if (depth <= 0 || solidKey(world, key)) return
  const x = key % width
  const y = (key - x) / width
  if (!solidKey(world, key + width)) {
    const landing = restingKey(world, x, y + 1)
    field.flow[key] -= depth
    if (landing >= 0 && activate(field, landing)) {
      field.flow[landing] += depth
      noteFall(field, x, y, (landing - (landing % width)) / width, depth)
    }
    return
  }
  const below = stairBelow(world, x, y + 1)
  if (below >= 0) {
    const landing = restingKey(world, x, below - 1)
    if (landing >= 0) {
      move(field, key, landing, depth * STAIR_SHARE)
      noteFall(field, x, y, below - 1, depth * STAIR_SHARE)
    }
  }
  let budget = depth * (below >= 0 ? 1 - STAIR_SHARE : 1)
  for (let side = -1; side <= 1; side += 2) {
    const next = key + side
    if (solidKey(world, next)) continue
    let amount: number
    if (!solidKey(world, next + width)) amount = depth * EDGE_SHARE
    else {
      if (depth < MIN_SPREAD) continue
      amount = SHARE * (depth - field.depth[next])
    }
    amount = Math.min(amount, budget * 0.5)
    if (amount <= 0) continue
    budget -= amount
    move(field, key, next, amount)
  }
}

function settle(world: World, field: LiquidField, tick: number): void {
  const drain = DRAIN[field.kind] * tick
  const active = field.active
  let kept = 0
  for (let index = 0; index < active.length; index += 1) {
    const key = active[index]
    let depth = field.depth[key] + field.flow[key] - drain
    field.flow[key] = 0
    if (depth < EMPTY || solidKey(world, key)) depth = 0
    field.depth[key] = Math.min(MAX_DEPTH, depth)
    field.live[key] = depth > 0 ? 1 : 0
    if (depth > 0) active[kept++] = key
  }
  active.length = kept
}

/** Every wet cell, for drawing and tests: tile, depth. */
export function eachLiquidCell(world: World, kind: LiquidKind, visit: (x: number, y: number, depth: number) => void): void {
  const field = world.systems[kind]
  if (!field || field.size !== world.grid.width * world.grid.height) return
  const width = world.grid.width
  for (const key of field.active) {
    const x = key % width
    visit(x, (key - x) / width, field.depth[key])
  }
}

/** Total liquid lying on floors, for tests. */
export function liquidVolume(world: World, kind: LiquidKind): number {
  let total = 0
  eachLiquidCell(world, kind, (_x, _y, depth) => { total += depth })
  return total
}
