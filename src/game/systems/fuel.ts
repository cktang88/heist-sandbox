import { fireHeatAt, startFire } from '../hazards/fire'
import { propBox, propById, propCenter } from '../hazards/props'
import { propSpec, type PropKind } from '../propCatalog'
import type { World } from '../world'
import { takeLiquid } from './liquid'
import { addSource } from './sources'

/**
 * Fuel. A holed tank (a car, a generator, a fuel drum: shot but not yet blown) leaks a trail that runs downhill and
 * through holes like water. Flame reaching any part of the trail runs along all of it, back to whatever leaked it.
 */
type Leak = { rate: number; seconds: number }
const TANKS: Partial<Record<PropKind, Leak>> = {
  car: { rate: 0.2, seconds: 30 }, van: { rate: 0.25, seconds: 30 }, truck: { rate: 0.3, seconds: 35 }, forklift: { rate: 0.15, seconds: 20 },
  generator: { rate: 0.2, seconds: 25 }, explosiveBarrel: { rate: 0.3, seconds: 14 },
}
/** Depth burnt off per second; a thin trail burns a few seconds. */
const BURN = 0.02
const LIGHTS = 0.01

const watched = new WeakMap<object, { count: number; ids: number[] }>()

function tanks(world: World): number[] {
  const known = watched.get(world.props)
  if (known && known.count === world.props.length) return known.ids
  const ids = world.props.filter((prop) => TANKS[prop.kind] !== undefined).map((prop) => prop.id)
  watched.set(world.props, { count: world.props.length, ids })
  return ids
}

/** Starts a leak at the base of a tank. Also the player's "open the fuel tap". */
export function leakFuel(world: World, id: number): boolean {
  const prop = propById(world, id)
  const leak = prop && !prop.broken ? TANKS[prop.kind] : undefined
  if (!prop || !leak || world.systems.spentProps.has(id)) return false
  world.systems.spentProps.add(id)
  const box = propBox(prop)
  addSource(world, 'fuel', { x: propCenter(prop).x, y: box.y + box.h - 0.3 }, leak.rate, leak.seconds, `fuel:${id}`)
  return true
}

/** Tanks that have taken a hit but not blown start to leak. */
export function watchTanks(world: World): void {
  for (const id of tanks(world)) {
    if (world.systems.spentProps.has(id)) continue
    const prop = propById(world, id)
    if (prop && !prop.broken && prop.hp < propSpec(prop.kind).hp) leakFuel(world, id)
  }
}

/** Fuel with flame on it burns, and lights the fuel beside it. */
export function burnFuel(world: World, tick: number): void {
  const field = world.systems.fuel
  if (!field || field.active.length === 0 || world.hazards.fires.size === 0) return
  const width = world.grid.width
  for (let index = 0; index < field.active.length; index += 1) {
    const key = field.active[index]
    const x = key % width
    const y = (key - x) / width
    if (field.depth[key] < LIGHTS || (fireHeatAt(world, x, y) <= 0 && fireHeatAt(world, x, y - 1) <= 0)) continue
    startFire(world, x, y, 1, 0.8)
    takeLiquid(world, 'fuel', key, BURN * tick)
    for (const side of [key - 1, key + 1]) {
      if (field.live[side] && field.depth[side] >= LIGHTS) startFire(world, side % width, y, 0.9, 0.8)
    }
  }
}
