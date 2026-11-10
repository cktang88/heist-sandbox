import { propSpec, type PropKind } from '../propCatalog'
import type { TileKind } from '../tiles'

/**
 * How much punch a round needs to get through one thing. A bullet starts with its gun's penetration power and
 * spends the resistance of everything it passes through; when it cannot pay, it stops there.
 * Numbers are game units, tuned so that: a pistol gets through glass but not a door, a rifle through a door but
 * not a brick wall, a sniper round through a brick partition and the door beyond it, and nothing through the
 * building's skeleton.
 */
const TILE_RESISTANCE: Record<TileKind, number> = {
  air: 0, ladder: 0, water: 0, fence: 0,
  glass: 1,
  wood: 2,
  duct: 2,
  door: 3,
  dirt: 6,
  brick: 7,
  concrete: 18,
  steel: 40,
  reinforced: Number.POSITIVE_INFINITY,
  bedrock: Number.POSITIVE_INFINITY,
}

/** A person soaks up a round; only a heavy one carries on out the other side. */
export const BODY_RESISTANCE = 4
/** Cameras, panels and boxes: sheet metal around a circuit board, about a door's worth. */
export const DEVICE_RESISTANCE = 3
const LOW_COVER_RESISTANCE = 3
const HIGH_COVER_RESISTANCE = 6
/** At most this share of a round's damage is lost to a layer that costs all of its power. */
const MAX_DAMAGE_LOSS = 0.5

export function tileResistance(kind: TileKind): number {
  return TILE_RESISTANCE[kind]
}

/** Furniture that cannot be destroyed (safes, the vault's kit) stops everything; the rest goes by how solid it is. */
export function propResistance(kind: PropKind): number {
  const spec = propSpec(kind)
  if (!Number.isFinite(spec.hp)) return Number.POSITIVE_INFINITY
  return spec.cover === 'high' ? HIGH_COVER_RESISTANCE : LOW_COVER_RESISTANCE
}

/** The parts of a round that a layer wears down. */
export type Round = { power: number; damage: number; tileDamage: number }

/**
 * Tries to push a round through one layer. If it has the power, it pays for the layer, loses some of its damage
 * in proportion to how much of its power that took, and returns true. Otherwise it is left as it was and stops.
 */
export function pierce(round: Round, resistance: number): boolean {
  if (resistance <= 0) return true
  if (round.power < resistance) return false
  const keep = 1 - MAX_DAMAGE_LOSS * (resistance / round.power)
  round.power -= resistance
  round.damage *= keep
  round.tileDamage *= keep
  return true
}
