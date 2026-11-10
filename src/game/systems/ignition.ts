import { burst } from '../effects'
import { nearestFire } from '../hazards/fire'
import { gasNear, igniteGasNear } from '../hazards/gas'
import { hasGas } from '../hazards/smoke'
import type { Lamp } from '../site'
import type { Vec } from '../types'
import type { World } from '../world'
import { circuitLive, isEnergized } from './circuits'

/**
 * Things that light gas: flames, live cables, current in water, a switch being thrown (every fitting on the circuit
 * sparks as it comes on or goes off, so a light on a timer is a fuse), and a guard's cigarette.
 */
const SPARK_REACH = 1.2
const CIGARETTE_REACH = 1

/** Is there something at this spot that would light gas? For guards who smell gas, and for the player's traps. */
export function ignitionSourceAt(world: World, at: Vec): boolean {
  if (nearestFire(world, at, 1.5)) return true
  const key = Math.floor(at.y) * world.grid.width + Math.floor(at.x)
  if (isEnergized(world, key) || isEnergized(world, key + world.grid.width)) return true
  for (const wire of world.systems.wires) {
    if (circuitLive(world, wire.circuit) && Math.abs(wire.x - at.x) < 1 && at.y >= wire.top - 1 && at.y <= wire.y + 1) return true
  }
  return world.systems.faults.some((fault) => fault.kind === 'sparkingLamp' && fault.lamp && Math.hypot(fault.x - at.x, fault.y - at.y) < SPARK_REACH + 0.5)
}

/** For the guard code: a guard lights up. In gas, that is the last thing he does. Returns whether it lit anything. */
export function lightCigarette(world: World, at: Vec): boolean {
  if (!gasNear(world, Math.floor(at.x), Math.floor(at.y))) return false
  igniteGasNear(world, at, CIGARETTE_REACH)
  return true
}

/** Lamps and switches filed by circuit, found once per lamp list. */
const byCircuit = new WeakMap<object, Map<number, Lamp[]>>()

function lampsOn(world: World, circuit: number): Lamp[] {
  let index = byCircuit.get(world.lamps)
  if (!index) {
    index = new Map()
    for (const lamp of world.lamps) if (lamp.circuit !== undefined) index.set(lamp.circuit, [...(index.get(lamp.circuit) ?? []), lamp])
    byCircuit.set(world.lamps, index)
  }
  return index.get(circuit) ?? []
}

/** Spots that spark when a circuit is switched: its fittings, fuse boxes and light switches. */
function sparkPoints(world: World, circuit: number): Vec[] {
  const points: Vec[] = lampsOn(world, circuit).map((lamp) => ({ x: lamp.x, y: lamp.y }))
  for (const device of world.devices) {
    if (device.circuit === circuit && (device.kind === 'fusebox' || device.kind === 'lightSwitch')) points.push({ x: device.x + 0.5, y: device.y + 0.5 })
  }
  return points
}

/** A circuit just switched on or off: each fitting on it sparks, which lights any gas around it. */
export function sparkSwitchedCircuits(world: World): void {
  const before = world.systems.deadBefore
  const now = world.deadCircuits
  let same = before.size === now.size
  if (same) for (const circuit of now) if (!before.has(circuit)) same = false
  if (same) return
  const changed = [...now].filter((circuit) => !before.has(circuit)).concat([...before].filter((circuit) => !now.has(circuit)))
  world.systems.deadBefore = new Set(now)
  if (!hasGas(world)) return
  for (const circuit of changed) {
    for (const point of sparkPoints(world, circuit)) {
      if (!gasNear(world, Math.floor(point.x), Math.floor(point.y))) continue
      burst(world.effects, world.systems.rng, point, 6, '#ffe08a', 4)
      igniteGasNear(world, point, SPARK_REACH)
    }
  }
}
