import { tileKey } from '../hazards/state'
import type { Body, Vec } from '../types'
import type { World } from '../world'
import { liquidAt } from './liquid'

/**
 * What is underfoot, shared by the player and the guards: dry floor, a wet or fuel-slick floor (running on it can
 * put you down), water to wade through, water too deep to stand in, or water carrying current.
 */
export type Footing = 'dry' | 'wet' | 'slick' | 'wading' | 'deep' | 'live'

export const WADING_DEPTH = 0.35
export const DEEP_DEPTH = 1.3
const PUDDLE = 0.02

/** The tile a body's feet are in. */
export function feetTile(body: Body): Vec {
  return { x: Math.floor(body.x + body.w / 2), y: Math.floor(body.y + body.h - 0.05) }
}

/** Footing at a spot, given as the point where the feet are (or any point in the tile a person stands in). */
export function footingAt(world: World, at: Vec): Footing {
  const x = Math.floor(at.x)
  const y = Math.floor(at.y)
  const key = tileKey(world, x, y)
  if (world.systems.energized.has(key)) return 'live'
  const water = liquidAt(world, 'water', x, y)
  if (water >= DEEP_DEPTH) return 'deep'
  if (water >= WADING_DEPTH) return 'wading'
  if (liquidAt(world, 'fuel', x, y) >= PUDDLE) return 'slick'
  if (water >= PUDDLE || world.hazards.wet.has(key) || world.hazards.wet.has(key + world.grid.width)) return 'wet'
  return 'dry'
}

export function footingOf(world: World, body: Body): Footing {
  return footingAt(world, feetTile(body))
}

/** Can someone stand here without being hurt or knocked down? For guards picking where to stand and walk. */
export function safeFooting(world: World, at: Vec): boolean {
  const footing = footingAt(world, at)
  return footing !== 'live' && footing !== 'deep' && !world.hazards.fires.has(tileKey(world, Math.floor(at.x), Math.floor(at.y)))
}

/** Chance per second that someone running here goes down. */
export function slipRate(footing: Footing): number {
  if (footing === 'slick') return 1.4
  if (footing === 'wet') return 0.6
  return 0
}

/** Is anything underfoot anywhere? When not, nobody's footing needs checking. */
export function anythingUnderfoot(world: World): boolean {
  return world.hazards.wet.size > 0 || !!world.systems.water?.active.length || !!world.systems.fuel?.active.length
}
