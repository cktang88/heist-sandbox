import { hurtTile } from '../destruction'
import { burst } from '../effects'
import { playSound } from '../sounds'
import { TILE_DEFS, type TileKind } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'

const DUST = '#d8d2c4'
const SPARK = '#ffd36b'
/** Metal and the building's skeleton throw sparks; the rest throws dust or splinters in its own colour. */
const SPARKS: ReadonlySet<TileKind> = new Set(['steel', 'reinforced', 'duct'])
const SOFT: ReadonlySet<TileKind> = new Set(['glass', 'wood', 'door', 'brick', 'dirt'])

/**
 * A round meets a tile: chips it and throws the matching debris. A round that carries on through (`through`)
 * throws less, since most of its force goes with it.
 */
export function strikeTile(world: World, at: Vec, tileX: number, tileY: number, kind: TileKind, tileDamage: number, through: boolean): void {
  const broke = hurtTile(world, tileX, tileY, tileDamage)
  if (kind === 'glass' && broke) playSound(world, 'glass', at)
  const count = through ? 1 : 2
  if (SPARKS.has(kind)) burst(world.effects, world.rng, at, count + 2, SPARK, 6)
  else burst(world.effects, world.rng, at, count, SOFT.has(kind) ? TILE_DEFS[kind].color : DUST, 4)
}
