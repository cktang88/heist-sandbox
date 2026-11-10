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
const SIDE_SHARE = 0.16
const DOWN_SHARE = 0.05
const COOL_RISE = 0.05
const HOT_RISE = 0.3
/** A cell below a smoky one keeps rising into it until it is this fraction as dense: smoke layers from the top. */
const LAYERING = 0.8
const GAS_SHARE = 0.11
/** Per second, the fraction of each kind that thins away. Fire smoke lingers; foam is gone in a second or two. */
const FADE = { screen: 0.13, toxic: 0.035, foam: 1.6, gas: 0.03 }
const EMPTY = 0.004
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
    active: new Set(), gasCells: 0,
  }
  world.hazards.smoke = made
  return made
}

function solidKey(world: World, key: number): boolean {
  return SOLID[world.grid.kinds[key]]
}

/** The open tile nearest a spot: itself, or the one above, or beside it. -1 if boxed in. */
function openKey(world: World, x: number, y: number): number {
  const { width, height } = world.grid
  for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [1, 0], [0, 1]]) {
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
  if (!smoke.active.has(key) && smoke.active.size >= MAX_SMOKE_CELLS) return
  const layer = kind === 'screen' ? smoke.screen : kind === 'toxic' ? smoke.toxic : smoke.foam
  layer[key] = Math.min(MAX_PRESSURE, layer[key] + amount)
  smoke.active.add(key)
}

export function addGas(world: World, x: number, y: number, amount: number): void {
  const key = openKey(world, x, y)
  if (key < 0) return
  const smoke = field(world)
  if (!smoke.active.has(key) && smoke.active.size >= MAX_SMOKE_CELLS) return
  smoke.gas[key] = Math.min(MAX_PRESSURE, smoke.gas[key] + amount)
  smoke.active.add(key)
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
  return amount
}

export function hasGas(world: World): boolean {
  return (world.hazards.smoke?.gasCells ?? 0) > 0
}

/** Thins the smoke at one tile, e.g. under a water spray. `keep` is the share that stays. */
export function thinSmoke(world: World, x: number, y: number, keep: number): void {
  const smoke = world.hazards.smoke
  const key = keyAt(world, x, y)
  if (!smoke || key < 0 || !smoke.active.has(key)) return
  smoke.screen[key] *= keep
  smoke.toxic[key] *= keep
  smoke.foam[key] *= keep
}

/** Sight through smoke along a segment: 0 is clear, 1 is impossible to see through. */
export function smokeBetween(world: World, from: Vec, to: Vec): number {
  const smoke = world.hazards.smoke
  if (!smoke || smoke.active.size === 0) return 0
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
  if (!smoke || smoke.active.size === 0) return
  const touched = new Set(smoke.active)
  for (const key of smoke.active) spreadFrom(world, smoke, key, touched)
  settle(world, smoke, touched, tick)
}

function spreadFrom(world: World, smoke: SmokeField, key: number, touched: Set<number>): void {
  const { width, height } = world.grid
  const x = key % width
  const y = (key - x) / width
  const neighbours = [y > 0 ? key - width : -1, x > 0 ? key - 1 : -1, x < width - 1 ? key + 1 : -1, y < height - 1 ? key + width : -1]
  const open = neighbours.map((other) => other >= 0 && !solidKey(world, other))
  const total = density(smoke, key)
  if (total > EMPTY) {
    const rise = COOL_RISE + (HOT_RISE - COOL_RISE) * (smoke.toxic[key] / total)
    const [up, left, right, down] = neighbours
    if (open[0]) moveSmoke(smoke, key, up, rise * Math.max(0, total - LAYERING * density(smoke, up)), total, touched)
    if (open[1]) moveSmoke(smoke, key, left, SIDE_SHARE * Math.max(0, total - density(smoke, left)), total, touched)
    if (open[2]) moveSmoke(smoke, key, right, SIDE_SHARE * Math.max(0, total - density(smoke, right)), total, touched)
    if (open[3]) moveSmoke(smoke, key, down, DOWN_SHARE * Math.max(0, total - density(smoke, down) - 0.2), total, touched)
  }
  const gas = smoke.gas[key]
  if (gas <= EMPTY) return
  neighbours.forEach((other, index) => {
    if (!open[index] || !canTouch(touched, other)) return
    const amount = GAS_SHARE * Math.max(0, gas - smoke.gas[other])
    smoke.flow[3][key] -= amount
    smoke.flow[3][other] += amount
    touched.add(other)
  })
}

function canTouch(touched: Set<number>, key: number): boolean {
  return touched.has(key) || touched.size < MAX_SMOKE_CELLS
}

/** Moves `amount` of a cell's smoke to a neighbour, keeping the mix of kinds. */
function moveSmoke(smoke: SmokeField, from: number, to: number, amount: number, total: number, touched: Set<number>): void {
  if (amount <= 0 || !canTouch(touched, to)) return
  const share = amount / total
  const layers = [smoke.screen, smoke.toxic, smoke.foam]
  for (let index = 0; index < 3; index += 1) {
    const moved = layers[index][from] * share
    smoke.flow[index][from] -= moved
    smoke.flow[index][to] += moved
  }
  touched.add(to)
}

/** Applies the flows, thins everything and drops cells that have emptied. */
function settle(world: World, smoke: SmokeField, touched: Set<number>, tick: number): void {
  const layers = [smoke.screen, smoke.toxic, smoke.foam, smoke.gas]
  const keep = [FADE.screen, FADE.toxic, FADE.foam, FADE.gas].map((fade) => Math.max(0, 1 - fade * tick))
  const skyRow = SKY_ROWS * world.grid.width
  smoke.active.clear()
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
    if (left <= 0) continue
    smoke.active.add(key)
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
