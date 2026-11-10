import { hurtTile } from '../destruction'
import { emitNoise } from '../noise'
import { roomAt } from '../site'
import { playSound } from '../sounds'
import { TILE_DEFS, tileAt, type TileKind } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { canCatch, heatProps, igniteProp, isFedByProp } from './burning'
import { gasNear, igniteGas } from './gas'
import { propsAt } from './props'
import { addSmoke } from './smoke'
import { tileKey, type Fire } from './state'

/** A big fire tops out here; new tiles stop catching until some burn out. */
export const MAX_FIRES = 600
/** Tile damage per second at full heat. A wooden wall lasts about 16 s, a door about 14 s. */
const BURN_RATE: Partial<Record<TileKind, number>> = { wood: 1.6, door: 3.6 }
/** Chance per second, at full heat, that fire jumps to a neighbouring fuel: fastest upward, slowest downward. */
const SPREAD_PER_SECOND = 0.9
const SPREAD: readonly (readonly [number, number, number])[] = [
  [0, -1, 1], [-1, -1, 0.5], [1, -1, 0.5], [-1, 0, 0.42], [1, 0, 0.42], [0, 1, 0.12],
]
/** Burning props shed flames onto the floor beside them, so fire creeps along a row of furniture. */
const FLOOR_CREEP = 0.5
const GROW_PER_SECOND = 0.3
const STARVE_PER_SECOND = 0.6
/** How long fire lingers on something that cannot burn. */
export const FLARE_SECONDS = 0.8
const SMOKE_PER_SECOND = 0.9
const NOISE_RADIUS = 10

export function tileBurns(kind: TileKind): boolean {
  return BURN_RATE[kind] !== undefined
}

/**
 * Lights or feeds a fire on one tile. Fire sits on burnable tiles, or in open air where it only flares
 * unless a burning prop feeds it. Returns false if nothing could catch there.
 */
export function startFire(world: World, x: number, y: number, heat: number, flare = FLARE_SECONDS): boolean {
  const hazards = world.hazards
  const kind = tileAt(world.grid, x, y)
  if (kind === 'bedrock' || (TILE_DEFS[kind].solid && !tileBurns(kind))) return false
  const key = tileKey(world, x, y)
  if (hazards.wet.has(key)) return false
  const existing = hazards.fires.get(key)
  if (existing) {
    existing.heat = Math.min(1, Math.max(existing.heat, heat))
    existing.flare = Math.max(existing.flare, flare)
    return true
  }
  if (hazards.fires.size >= MAX_FIRES) return false
  hazards.fires.set(key, { x, y, heat: Math.min(1, heat), flare, room: roomAt(world.rooms, x + 0.5, y + 0.5)?.id ?? -1 })
  return true
}

/** One fire tick: burn, spread, smoke. Returns the rooms with a real fire in them, for the sprinklers. */
export function stepFires(world: World, tick: number): Set<number> {
  const hazards = world.hazards
  const rooms = new Set<number>()
  // A snapshot, so fires lit this tick wait until the next one to spread.
  for (const [key, fire] of [...hazards.fires]) {
    if (!burnOne(world, key, fire, tick)) continue
    if (fire.room >= 0 && fire.heat > 0.3) rooms.add(fire.room)
    if (gasNear(world, fire.x, fire.y)) igniteGas(world, fire.x, fire.y)
  }
  makeFireNoise(world, tick)
  return rooms
}

/** Burns one tile for a tick. Returns false if the fire went out. */
function burnOne(world: World, key: number, fire: Fire, tick: number): boolean {
  const hazards = world.hazards
  const kind = tileAt(world.grid, fire.x, fire.y)
  const burnRate = BURN_RATE[kind]
  // Doused, or a falling tile of stone landed on it.
  if (hazards.wet.has(key) || (TILE_DEFS[kind].solid && burnRate === undefined)) {
    hazards.fires.delete(key)
    return false
  }
  let fed = burnRate !== undefined
  if (burnRate !== undefined && hurtTile(world, fire.x, fire.y, burnRate * fire.heat * tick)) {
    fed = false
    fire.flare = FLARE_SECONDS
  }
  const propFed = !fed && isFedByProp(world, fire.x, fire.y)
  if (fed || propFed) fire.heat = Math.min(1, fire.heat + GROW_PER_SECOND * tick)
  else {
    fire.flare -= tick
    fire.heat -= STARVE_PER_SECOND * tick
    if (fire.flare <= 0 || fire.heat <= 0.02) {
      hazards.fires.delete(key)
      return false
    }
  }
  spread(world, fire, fed || propFed, propFed, tick)
  heatProps(world, fire, tick)
  addSmoke(world, fire.x, fire.y, SMOKE_PER_SECOND * fire.heat * tick, 'toxic')
  return true
}

function spread(world: World, fire: Fire, fed: boolean, propFed: boolean, tick: number): void {
  const hazards = world.hazards
  const strength = SPREAD_PER_SECOND * fire.heat * tick * (fed ? 1 : 0.6)
  for (const [dx, dy, share] of SPREAD) {
    const x = fire.x + dx
    const y = fire.y + dy
    const key = tileKey(world, x, y)
    if (hazards.fires.has(key) || hazards.wet.has(key)) continue
    const kind = tileAt(world.grid, x, y)
    if (tileBurns(kind)) {
      if (world.rng() < strength * share) startFire(world, x, y, 0.35)
      continue
    }
    if (TILE_DEFS[kind].solid) continue
    const burnable = propsAt(world, x, y).filter((id) => canCatch(world, id))
    if (burnable.length > 0 && world.rng() < strength * share) {
      for (const id of burnable) igniteProp(world, id)
      continue
    }
    const onFloor = dy === 0 && TILE_DEFS[tileAt(world.grid, x, y + 1)].solid
    if (propFed && onFloor && world.rng() < strength * share * FLOOR_CREEP) startFire(world, x, y, 0.5, FLARE_SECONDS * 1.5)
  }
}

/** Fire crackles now and then, which guards can hear. */
function makeFireNoise(world: World, tick: number): void {
  const hazards = world.hazards
  hazards.soundClock -= tick
  if (hazards.soundClock > 0 || hazards.fires.size === 0) return
  hazards.soundClock = 2 + world.rng() * 2
  let pick = Math.floor(world.rng() * hazards.fires.size)
  for (const fire of hazards.fires.values()) {
    if (pick-- > 0) continue
    const at = { x: fire.x + 0.5, y: fire.y + 0.5 }
    playSound(world, 'fire', at)
    emitNoise(world, at, NOISE_RADIUS)
    return
  }
}

export function isBurningAt(world: World, at: Vec): boolean {
  return world.hazards.fires.has(tileKey(world, Math.floor(at.x), Math.floor(at.y)))
}

/** How hot the fire is at a tile, 0 if none. */
export function fireHeatAt(world: World, x: number, y: number): number {
  return world.hazards.fires.get(tileKey(world, x, y))?.heat ?? 0
}

/** The middle of the nearest burning tile within `range`, or null. */
export function nearestFire(world: World, at: Vec, range = Number.POSITIVE_INFINITY): Vec | null {
  let best: Vec | null = null
  let bestGap = range
  for (const fire of world.hazards.fires.values()) {
    const gap = Math.hypot(fire.x + 0.5 - at.x, fire.y + 0.5 - at.y)
    if (gap > bestGap) continue
    bestGap = gap
    best = { x: fire.x + 0.5, y: fire.y + 0.5 }
  }
  return best
}
