import type { PropState } from '../cover'
import { propSpec } from '../propCatalog'
import type { World } from '../world'
import { startFire } from './fire'
import { propById, propsAt, propTiles } from './props'
import { breakProp } from './reactions'
import { tileKey, type Fire } from './state'

/** Explosive props that catch fire go off soon; everything else burns for a time set by its size. */
const COOK_OFF_SECONDS = 2.5
const MIN_BURN_SECONDS = 5
const MAX_BURN_SECONDS = 30
/** Chance per second, at full heat, that a burnable prop standing in fire catches. */
const CATCH_PER_SECOND = 1.5

function burnSeconds(prop: PropState): number {
  const spec = propSpec(prop.kind)
  if (spec.reacts === 'explodes') return COOK_OFF_SECONDS
  return Math.min(MAX_BURN_SECONDS, Math.max(MIN_BURN_SECONDS, 5 + spec.w * spec.h * 1.5))
}

/** Seconds of fire a prop that does not burn can sit in before it bursts (gas cylinders, generators, boilers). */
function cookSeconds(prop: PropState): number {
  return 3 + Math.min(propSpec(prop.kind).hp, 450) / 150
}

export function canCatch(world: World, id: number): boolean {
  const prop = propById(world, id)
  const hazards = world.hazards
  return !!prop && !prop.broken && propSpec(prop.kind).burns && !hazards.burningProps.has(id) && !hazards.burntProps.has(id)
}

export function igniteProp(world: World, id: number): void {
  if (!canCatch(world, id)) return
  const prop = propById(world, id)!
  world.hazards.burningProps.set(id, burnSeconds(prop))
  for (const tile of propTiles(prop)) startFire(world, tile.x, tile.y, 0.4)
}

export function isFedByProp(world: World, x: number, y: number): boolean {
  const burning = world.hazards.burningProps
  if (burning.size === 0) return false
  return propsAt(world, x, y).some((id) => burning.has(id))
}

/** Counts down burning props, keeps their tiles alight, and breaks them when they are spent or doused. */
export function stepBurningProps(world: World, tick: number): void {
  const hazards = world.hazards
  for (const [id, left] of [...hazards.burningProps]) {
    const prop = propById(world, id)
    if (!prop || prop.broken) {
      hazards.burningProps.delete(id)
      continue
    }
    const tiles = propTiles(prop)
    if (tiles.some((tile) => hazards.wet.has(tileKey(world, tile.x, tile.y)))) {
      hazards.burningProps.delete(id)
      continue
    }
    if (left - tick > 0) {
      hazards.burningProps.set(id, left - tick)
      for (const tile of tiles) startFire(world, tile.x, tile.y, 0.3)
      continue
    }
    hazards.burningProps.delete(id)
    if (Number.isFinite(prop.hp)) breakProp(world, prop)
    else hazards.burntProps.add(id)
  }
}

/** A fire touching props: burnable ones may catch, pressurised ones heat up until they burst. */
export function heatProps(world: World, fire: Fire, tick: number): void {
  const hazards = world.hazards
  for (const id of propsAt(world, fire.x, fire.y)) {
    if (canCatch(world, id)) {
      if (world.rng() < CATCH_PER_SECOND * fire.heat * tick) igniteProp(world, id)
      continue
    }
    const prop = propById(world, id)
    if (!prop || prop.broken || propSpec(prop.kind).reacts !== 'explodes' || hazards.burningProps.has(id)) continue
    const cooked = (hazards.cooking.get(id) ?? 0) + tick
    hazards.cooking.set(id, cooked)
    if (cooked >= cookSeconds(prop)) {
      hazards.cooking.delete(id)
      breakProp(world, prop)
    }
  }
}
