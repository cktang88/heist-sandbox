import { burst } from './effects'
import { damageTile, TILE_DEFS } from './tiles'
import type { World } from './world'

/** Hurts a tile and, if it breaks, counts it and throws rubble. Returns true when the tile broke. */
export function hurtTile(world: World, tileX: number, tileY: number, amount: number): boolean {
  const destroyed = damageTile(world.grid, tileX, tileY, amount)
  if (!destroyed) return false
  world.stats.tilesDestroyed += 1
  world.structureChanged = true
  burst(world.effects, world.rng, { x: tileX + 0.5, y: tileY + 0.5 }, 4, TILE_DEFS[destroyed].color, 7)
  return true
}
