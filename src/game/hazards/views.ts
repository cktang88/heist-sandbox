import { centerOf, type Vec } from '../types'
import type { World } from '../world'
import { eachSmokeCell } from './smoke'
import type { GrenadeKind, HazardState, SprayKind } from './state'

/**
 * Read-only views for drawing. Their shapes are a contract with the renderer: keep them stable.
 * Cells are one tile each, `x`/`y` being the tile's column and row; `intensity` and `density` run 0..1.
 */
export type FireCell = Vec & { intensity: number }
export type SmokeCell = Vec & { density: number; toxic: boolean }
export type GrenadeView = Vec & { kind: GrenadeKind; fuse: number }
export type SprayView = Vec & { angle: number; kind: SprayKind }
/** A flash going off right now, so the renderer can light the room. `life` counts down from 1. */
export type FlashView = Vec & { life: number }

/**
 * The fire and smoke views can hold hundreds of cells, so they reuse their array and objects from call to call
 * and drawing every frame allocates nothing. The returned array is only valid until the next call.
 */
type Pools = { fire: FireCell[]; smoke: SmokeCell[] }
const pools = new WeakMap<HazardState, Pools>()

function poolsOf(world: World): Pools {
  const existing = pools.get(world.hazards)
  if (existing) return existing
  const made: Pools = { fire: [], smoke: [] }
  pools.set(world.hazards, made)
  return made
}

export function fireCells(world: World): readonly FireCell[] {
  const pool = poolsOf(world).fire
  let count = 0
  for (const fire of world.hazards.fires.values()) {
    if (count >= pool.length) pool.push({ x: 0, y: 0, intensity: 0 })
    const cell = pool[count]
    cell.x = fire.x
    cell.y = fire.y
    cell.intensity = fire.heat
    count += 1
  }
  pool.length = count
  return pool
}

export function smokeCells(world: World): readonly SmokeCell[] {
  const pool = poolsOf(world).smoke
  let count = 0
  eachSmokeCell(world, (x, y, density, toxic) => {
    if (count >= pool.length) pool.push({ x, y, density, toxic })
    const cell = pool[count]
    cell.x = x
    cell.y = y
    cell.density = density
    cell.toxic = toxic
    count += 1
  })
  pool.length = count
  return pool
}

export function grenadeViews(world: World): readonly GrenadeView[] {
  return world.hazards.grenades.map((grenade) => ({ ...centerOf(grenade), kind: grenade.kind, fuse: Math.max(0, grenade.fuse) }))
}

export function sprayViews(world: World): readonly SprayView[] {
  return world.hazards.sprays.map((spray) => ({ x: spray.x, y: spray.y, angle: spray.angle, kind: spray.kind }))
}

export function flashViews(world: World): readonly FlashView[] {
  return world.hazards.flashes.map((item) => ({ x: item.x, y: item.y, life: item.life }))
}
