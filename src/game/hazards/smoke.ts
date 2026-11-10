import { TILE_DEFS, TILE_KINDS } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import type { SmokeField } from './state'

/**
 * Smoke and gas as a coarse per-tile field. Each tick a cell hands part of what it holds to its open neighbours:
 * hot (toxic) smoke mostly upward, so rooms fill from the ceiling down; cool screening smoke mostly sideways.
 * Flammable gas just spreads evenly. Solid tiles block everything, so open doors and holes are the only way out.
 */
export type SmokeKind = 'screen' | 'toxic' | 'foam'

/** Enough to fill a dozen large rooms; past this, smoke stops spreading into new tiles until some thins away. */
export const MAX_SMOKE_CELLS = 5000
/** Values above 1 are pressure: a fresh puff pushes outward fast but still only reads as fully opaque. */
const MAX_PRESSURE = 4
const SIDE_SHARE = 0.22
const DOWN_SHARE = 0.05
const COOL_RISE = 0.05
const HOT_RISE = 0.3
/** A cell below a smoky one keeps rising into it until it is this fraction as dense: smoke layers from the top. */
const LAYERING = 0.8
const GAS_SHARE = 0.11
/** Per second, the fraction of each kind that thins away. Fire smoke lingers; foam is gone in a second or two. */
const FADE = { screen: 0.13, toxic: 0.035, foam: 1.6, gas: 0.03 }
const EMPTY = 0.0005
/** Smoke reaching the top rows of the map has escaped into the sky. */
const SKY_ROWS = 2
/** How fast sight is lost per tile of full smoke. Two tiles of thick smoke read as 0.63. */
const OPACITY_PER_TILE = 0.5

const SOLID = TILE_KINDS.map((kind) => TILE_DEFS[kind].solid)

function field(world: World): SmokeField {
  if (world.hazards.smoke) return world.hazards.smoke
  const size = world.grid.width * world.grid.height
  const made: SmokeField = {
    width: world.grid.width,
    screen: new Float32Array(size), toxic: new Float32Array(size), foam: new Float32Array(size), gas: new Float32Array(size),
    flow: [new Float32Array(size), new Float32Array(size), new Float32Array(size), new Float32Array(size)],
    active: [], live: new Uint8Array(size), seen: new Int32Array(size), stamp: 0, gasCells: 0,
  }
  world.hazards.smoke = made
  return made
}

function solidKey(world: World, key: number): boolean {
  return SOLID[world.grid.kinds[key]]
}

const NEAREST_OPEN: readonly (readonly [number, number])[] = [[0, 0], [0, -1], [-1, 0], [1, 0], [0, 1]]

/** Marks a tile as holding something. False if it is new and the field is already at its cap. */
function activate(smoke: SmokeField, key: number): boolean {
  if (smoke.live[key]) return true
  if (smoke.active.length >= MAX_SMOKE_CELLS) return false
  smoke.live[key] = 1
  smoke.active.push(key)
  return true
}

/** The open tile nearest a spot: itself, or the one above, or beside it. -1 if boxed in. */
function openKey(world: World, x: number, y: number): number {
  const { width, height } = world.grid
  for (const [dx, dy] of NEAREST_OPEN) {
    const tx = x + dx
    const ty = y + dy
    if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue
    const key = ty * width + tx
    if (!solidKey(world, key)) return key
  }
  return -1
}

export function addSmoke(world: World, x: number, y: number, amount: number, kind: SmokeKind): void {
  const key = openKey(world, x, y)
  if (key < 0) return
  const smoke = field(world)
  if (!activate(smoke, key)) return
  const layer = kind === 'screen' ? smoke.screen : kind === 'toxic' ? smoke.toxic : smoke.foam
  layer[key] = Math.min(MAX_PRESSURE, layer[key] + amount)
}

/** Raises the screening smoke at a tile to at least `target`. Used to puff out a grenade's cloud evenly. */
export function topUpSmoke(world: World, key: number, target: number): void {
  const smoke = field(world)
  if (solidKey(world, key) || smoke.screen[key] >= target || !activate(smoke, key)) return
  smoke.screen[key] = target
}

/**
 * The open tiles nearest a spot, found by flooding outward around walls, nearest first.
 * A smoke grenade fills these, so its cloud takes the shape of the room it lands in.
 */
export function openAreaAround(world: World, x: number, y: number, count: number): number[] {
  const start = openKey(world, x, y)
  if (start < 0) return []
  const { width, height } = world.grid
  const found = [start]
  const seen = new Set(found)
  for (let index = 0; index < found.length && found.length < count; index += 1) {
    const key = found[index]
    const tx = key % width
    const ty = (key - tx) / width
    const around = [ty > 0 ? key - width : -1, tx > 0 ? key - 1 : -1, tx < width - 1 ? key + 1 : -1, ty < height - 1 ? key + width : -1]
    for (const other of around) {
      if (other < 0 || seen.has(other) || solidKey(world, other) || found.length >= count) continue
      seen.add(other)
      found.push(other)
    }
  }
  return found
}

export function addGas(world: World, x: number, y: number, amount: number): void {
  const key = openKey(world, x, y)
  if (key < 0) return
  const smoke = field(world)
  if (!activate(smoke, key)) return
  smoke.gas[key] = Math.min(MAX_PRESSURE, smoke.gas[key] + amount)
}

function density(smoke: SmokeField, key: number): number {
  return smoke.screen[key] + smoke.toxic[key] + smoke.foam[key]
}

function keyAt(world: World, x: number, y: number): number {
  const tx = Math.floor(x)
  const ty = Math.floor(y)
  if (tx < 0 || ty < 0 || tx >= world.grid.width || ty >= world.grid.height) return -1
  return ty * world.grid.width + tx
}

/** How thick the smoke is at a spot, 0..1. Gas does not count: it is (nearly) invisible. */
export function smokeDensityAt(world: World, at: Vec): number {
  const smoke = world.hazards.smoke
  const key = keyAt(world, at.x, at.y)
  if (!smoke || key < 0) return 0
  return Math.min(1, density(smoke, key))
}

/** How much of the smoke at a spot is toxic fire smoke, 0..1. */
export function toxicAt(world: World, at: Vec): number {
  const smoke = world.hazards.smoke
  const key = keyAt(world, at.x, at.y)
  if (!smoke || key < 0) return 0
  return Math.min(1, smoke.toxic[key])
}

export function gasAt(world: World, x: number, y: number): number {
  const smoke = world.hazards.smoke
  const key = keyAt(world, x, y)
  if (!smoke || smoke.gasCells === 0 || key < 0) return 0
  return smoke.gas[key]
}

/** Removes the gas from one tile and says how much there was. */
export function takeGas(world: World, x: number, y: number): number {
  const smoke = world.hazards.smoke
  const key = keyAt(world, x, y)
  if (!smoke || key < 0) return 0
  const amount = smoke.gas[key]
  smoke.gas[key] = 0
  if (amount > 0) smoke.gasCells -= 1
  return amount
}

export function hasGas(world: World): boolean {
  return (world.hazards.smoke?.gasCells ?? 0) > 0
}

/** Thins the smoke at one tile, e.g. under a water spray. `keep` is the share that stays. */
export function thinSmoke(world: World, x: number, y: number, keep: number): void {
  const smoke = world.hazards.smoke
  const key = keyAt(world, x, y)
  if (!smoke || key < 0 || !smoke.live[key]) return
  smoke.screen[key] *= keep
  smoke.toxic[key] *= keep
  smoke.foam[key] *= keep
}

/** Sight through smoke along a segment: 0 is clear, 1 is impossible to see through. */
export function smokeBetween(world: World, from: Vec, to: Vec): number {
  const smoke = world.hazards.smoke
  if (!smoke || smoke.active.length === 0) return 0
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(length / 0.5))
  const stepLength = length / steps
  let depth = 0
  for (let index = 0; index < steps; index += 1) {
    const along = (index + 0.5) / steps
    const key = keyAt(world, from.x + (to.x - from.x) * along, from.y + (to.y - from.y) * along)
    if (key >= 0) depth += Math.min(1, density(smoke, key)) * stepLength
  }
  return 1 - Math.exp(-depth * OPACITY_PER_TILE)
}

/** One smoke and gas tick. Flows are worked out from this tick's values first, then applied, so order does not matter. */
export function stepSmoke(world: World, tick: number): void {
  const smoke = world.hazards.smoke
  if (!smoke || smoke.active.length === 0) return
  smoke.stamp += 1
  const touched = smoke.active.slice()
  for (const key of touched) smoke.seen[key] = smoke.stamp
  for (let index = 0; index < smoke.active.length; index += 1) spreadFrom(world, smoke, smoke.active[index], touched)
  settle(world, smoke, touched, tick)
}

function spreadFrom(world: World, smoke: SmokeField, key: number, touched: number[]): void {
  const up = openNeighbour(world, key, 0, -1)
  const left = openNeighbour(world, key, -1, 0)
  const right = openNeighbour(world, key, 1, 0)
  const down = openNeighbour(world, key, 0, 1)
  const total = density(smoke, key)
  if (total > EMPTY) {
    const rise = COOL_RISE + (HOT_RISE - COOL_RISE) * (smoke.toxic[key] / total)
    if (up >= 0) moveSmoke(smoke, key, up, rise * Math.max(0, total - LAYERING * density(smoke, up)), total, touched)
    if (left >= 0) moveSmoke(smoke, key, left, SIDE_SHARE * Math.max(0, total - density(smoke, left)), total, touched)
    if (right >= 0) moveSmoke(smoke, key, right, SIDE_SHARE * Math.max(0, total - density(smoke, right)), total, touched)
    if (down >= 0) moveSmoke(smoke, key, down, DOWN_SHARE * Math.max(0, total - density(smoke, down) - 0.2), total, touched)
  }
  if (smoke.gas[key] <= EMPTY) return
  for (const other of [up, left, right, down]) if (other >= 0) moveGas(smoke, key, other, touched)
}

/** The key of the neighbouring tile in a direction, or -1 if it is off the map or solid. */
function openNeighbour(world: World, key: number, dx: number, dy: number): number {
  const { width, height } = world.grid
  const x = key % width
  const y = (key - x) / width
  if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) return -1
  const other = key + dy * width + dx
  return solidKey(world, other) ? -1 : other
}

/** Adds a tile to this tick's list, unless it is new and the field is full. */
function touch(smoke: SmokeField, touched: number[], key: number): boolean {
  if (smoke.seen[key] === smoke.stamp) return true
  if (touched.length >= MAX_SMOKE_CELLS) return false
  smoke.seen[key] = smoke.stamp
  touched.push(key)
  return true
}

/** Moves `amount` of a cell's smoke to a neighbour, keeping the mix of kinds. */
function moveSmoke(smoke: SmokeField, from: number, to: number, amount: number, total: number, touched: number[]): void {
  if (amount <= 0 || !touch(smoke, touched, to)) return
  const share = amount / total
  const [screen, toxic, foam] = smoke.flow
  const movedScreen = smoke.screen[from] * share
  const movedToxic = smoke.toxic[from] * share
  const movedFoam = smoke.foam[from] * share
  screen[from] -= movedScreen
  screen[to] += movedScreen
  toxic[from] -= movedToxic
  toxic[to] += movedToxic
  foam[from] -= movedFoam
  foam[to] += movedFoam
}

function moveGas(smoke: SmokeField, from: number, to: number, touched: number[]): void {
  const amount = GAS_SHARE * (smoke.gas[from] - smoke.gas[to])
  if (amount <= 0 || !touch(smoke, touched, to)) return
  smoke.flow[3][from] -= amount
  smoke.flow[3][to] += amount
}

/** Applies the flows, thins everything and drops cells that have emptied. */
function settle(world: World, smoke: SmokeField, touched: number[], tick: number): void {
  const layers = [smoke.screen, smoke.toxic, smoke.foam, smoke.gas]
  const keep = [FADE.screen, FADE.toxic, FADE.foam, FADE.gas].map((fade) => Math.max(0, 1 - fade * tick))
  const skyRow = SKY_ROWS * world.grid.width
  smoke.active.length = 0
  smoke.gasCells = 0
  for (const key of touched) {
    let left = 0
    const blocked = solidKey(world, key)
    for (let index = 0; index < 4; index += 1) {
      const layer = layers[index]
      let value = (layer[key] + smoke.flow[index][key]) * keep[index]
      smoke.flow[index][key] = 0
      if (blocked || value < EMPTY) value = 0
      if (key < skyRow) value *= 0.5
      layer[key] = Math.min(MAX_PRESSURE, value)
      left += value
    }
    smoke.live[key] = left > 0 ? 1 : 0
    if (left <= 0) continue
    smoke.active.push(key)
    if (smoke.gas[key] > 0) smoke.gasCells += 1
  }
}

/** Every smoky cell, for drawing and tests. Calls `visit` with the tile, density 0..1, and whether it is toxic. */
export function eachSmokeCell(world: World, visit: (x: number, y: number, density: number, toxic: boolean) => void): void {
  const smoke = world.hazards.smoke
  if (!smoke) return
  const width = world.grid.width
  for (const key of smoke.active) {
    const total = density(smoke, key)
    if (total < 0.02) continue
    const x = key % width
    visit(x, (key - x) / width, Math.min(1, total), smoke.toxic[key] > smoke.screen[key] + smoke.foam[key])
  }
}
