import { isLampShot } from '../ballistics/lampState'
import { burst } from '../effects'
import { startFire } from '../hazards/fire'
import { igniteGasNear } from '../hazards/gas'
import type { Lamp } from '../site'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import type { World } from '../world'
import { circuitLive } from './circuits'
import { liquidAt, restingKey } from './liquid'
import type { LiveWire } from './state'

/**
 * Live cables hanging loose: a fitting whose ceiling was blown away leaves its feed dangling to the floor, and the
 * player can pull one down on purpose. A live cable spits sparks now and then (lighting gas or fuel at its tip),
 * shocks whoever walks into it and electrifies any water it hangs in. Cutting the power makes it safe.
 */
const MAX_WIRES = 16
const HANG_REACH = 6
const SPARK_ODDS_PER_SECOND = 0.6
const SPARK = '#ffe08a'

export function dropWire(world: World, x: number, top: number, circuit: number | undefined): LiveWire | null {
  const wires = world.systems.wires
  if (wires.some((wire) => Math.abs(wire.x - x) < 0.5 && Math.abs(wire.top - top) < 2)) return null
  const key = restingKey(world, x, top + 0.5)
  if (key < 0) return null
  if (wires.length >= MAX_WIRES) wires.shift()
  const wire: LiveWire = { x, y: Math.floor(key / world.grid.width), top, circuit }
  wires.push(wire)
  return wire
}

/** Hung fittings filed by column, found once per lamp list. */
const columns = new WeakMap<object, Map<number, Lamp[]>>()

function hungByColumn(world: World): Map<number, Lamp[]> {
  const known = columns.get(world.lamps)
  if (known) return known
  const byColumn = new Map<number, Lamp[]>()
  for (const lamp of world.lamps) {
    if (!lamp.hung || lamp.circuit === undefined) continue
    const column = Math.floor(lamp.x)
    byColumn.set(column, [...(byColumn.get(column) ?? []), lamp])
  }
  columns.set(world.lamps, byColumn)
  return byColumn
}

function hangsFromSomething(world: World, lamp: Lamp): boolean {
  for (let rise = 0.7; rise <= HANG_REACH; rise += 1) if (isSolidAt(world.grid, lamp.x, lamp.y - rise)) return true
  return false
}

/** A fitting whose ceiling just went leaves its live feed hanging down to the floor. */
export function wiresFromOpenedCeilings(world: World, opened: readonly number[]): void {
  if (opened.length === 0) return
  const width = world.grid.width
  const byColumn = hungByColumn(world)
  for (const key of opened) {
    const x = key % width
    const y = (key - x) / width
    for (const lamp of byColumn.get(x) ?? []) {
      if (lamp.y < y || lamp.y - y > HANG_REACH + 1 || isLampShot(world, lamp) || hangsFromSomething(world, lamp)) continue
      dropWire(world, lamp.x, lamp.y, lamp.circuit)
    }
  }
}

/** Live cables spit sparks now and then, lighting gas or fuel at their tip. */
export function sparkWires(world: World, tick: number): void {
  for (const wire of world.systems.wires) {
    if (!circuitLive(world, wire.circuit) || world.systems.rng() > SPARK_ODDS_PER_SECOND * tick) continue
    const tip = { x: wire.x, y: wire.y + 0.8 }
    burst(world.effects, world.systems.rng, tip, 6, SPARK, 5)
    playSound(world, 'spark', tip)
    igniteGasNear(world, tip, 1.2)
    if (liquidAt(world, 'fuel', Math.floor(wire.x), wire.y) > 0) startFire(world, Math.floor(wire.x), wire.y, 0.9)
  }
}
