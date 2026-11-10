import { TILE_DEFS, tileAt, type TileKind } from '../tiles'
import { distance, type Vec } from '../types'
import type { World } from '../world'
import { HEARING } from './tuning'

/**
 * How sound travels. A sound has a radius in tiles; every solid tile on the straight line between the
 * source and the listener eats some of it (a door less than a wall, glass least, structural concrete most),
 * so a closed door matters and a slab between floors muffles all but gunshots and blasts.
 * This is a cheap stand-in for flooding the sound through the room graph.
 */

const SAMPLE_STEP = 0.5

function muffleOf(kind: TileKind): number {
  if (!TILE_DEFS[kind].solid) return 0
  if (kind === 'door') return HEARING.doorMuffle
  if (kind === 'glass' || kind === 'fence') return HEARING.glassMuffle
  if (kind === 'reinforced' || kind === 'steel' || kind === 'bedrock' || kind === 'dirt') return HEARING.heavyMuffle
  return HEARING.wallMuffle
}

/**
 * How much of a sound of this radius is left when it reaches the listener, in tiles of radius.
 * Zero or less means it is not heard. Stops counting walls as soon as the sound is spent.
 */
export function loudnessAt(world: World, from: Vec, to: Vec, radius: number): number {
  const gap = distance(from, to)
  let left = radius - gap
  if (left <= 0) return left
  const steps = Math.floor(gap / SAMPLE_STEP)
  const startTile = Math.floor(from.y) * world.grid.width + Math.floor(from.x)
  const endTile = Math.floor(to.y) * world.grid.width + Math.floor(to.x)
  let lastTile = startTile
  for (let step = 1; step < steps; step += 1) {
    const t = (step * SAMPLE_STEP) / gap
    const x = Math.floor(from.x + (to.x - from.x) * t)
    const y = Math.floor(from.y + (to.y - from.y) * t)
    const tile = y * world.grid.width + x
    if (tile === lastTile || tile === endTile) continue
    lastTile = tile
    left -= muffleOf(tileAt(world.grid, x, y))
    if (left <= 0) return left
  }
  return left
}

export type NoiseSource = 'player' | 'guard'
/** What a sound means to a guard: a shot or blast is evidence; a faint one only turns heads. */
export type NoiseKind = 'faint' | 'noise' | 'loud'

export function noiseKind(radius: number): NoiseKind {
  if (radius >= HEARING.loud) return 'loud'
  return radius < HEARING.faint ? 'faint' : 'noise'
}
