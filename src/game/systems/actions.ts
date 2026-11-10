import { hurtGuard, stunGuard } from '../guards'
import { startLeak } from '../hazards/gas'
import { propCenter, propsNear } from '../hazards/props'
import { startSpray } from '../hazards/sprays'
import { emitNoise } from '../noise'
import type { PropKind } from '../propCatalog'
import { playSound } from '../sounds'
import { tileAt } from '../tiles'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { propCircuit } from './circuits'
import { fanAction } from './fans'
import { leakFuel } from './fuel'
import { handbrakeAction } from './rolling'
import { addSource, sourceByTag, stopSource } from './sources'
import type { SystemAction } from './state'
import { dropWire } from './wires'

/**
 * The small hands-on actions that make deliberate set-ups possible: open a tap and flood a floor, loosen a gas
 * fitting, open a fuel tap, pull a live cable down, put a light on a timer, wedge something over a door. Each is in
 * the `{ prompt, key, run, hold? }` shape the interact code uses; `systemsAction` picks the one in reach.
 */
const REACH = 2
const VALVES: ReadonlySet<PropKind> = new Set(['sink', 'toilet', 'toiletStall', 'showerStall', 'waterTank', 'roofWaterTank', 'fireHydrant', 'waterCooler'])
const GAS_FITTINGS: ReadonlySet<PropKind> = new Set(['stove', 'fumeHood', 'gasCylinder', 'boiler'])
const FUEL_TAPS: ReadonlySet<PropKind> = new Set(['explosiveBarrel', 'generator', 'car', 'van', 'truck', 'forklift'])
const CABLES: ReadonlySet<PropKind> = new Set(['conduitRun', 'cableBundle', 'powerBox', 'switchgear'])
const VALVE_RATE = 0.7
const VALVE_SECONDS = 90
const GAS_SECONDS = 40
const LOOSEN_SECONDS = 1.5
const CABLE_SECONDS = 1.5
const RIG_SECONDS = 2
const TIMER_SECONDS = 10
const SLAM_NOISE = 14
const SLAM_STUN = 2.5
const SLAM_DAMAGE = 10

/** Whichever of these actions is in reach, or null. */
export function systemsAction(world: World): SystemAction | null {
  return valveAction(world) ?? gasFittingAction(world) ?? fuelTapAction(world) ?? cableAction(world) ?? timerAction(world)
    ?? rigDoorAction(world) ?? handbrakeAction(world) ?? fanAction(world)
}

function nearestProp(world: World, kinds: ReadonlySet<PropKind>, reach = REACH) {
  const hand = centerOf(world.player)
  return propsNear(world, hand, reach + 1).filter((prop) => !prop.broken && kinds.has(prop.kind))
    .sort((a, b) => distance(propCenter(a), hand) - distance(propCenter(b), hand))[0]
}

/** "E: open valve" at a tap, tank or hydrant: water pours until it is shut again. */
export function valveAction(world: World): SystemAction | null {
  const prop = nearestProp(world, VALVES)
  if (!prop) return null
  const tag = `valve:${prop.id}`
  const at = propCenter(prop)
  if (sourceByTag(world, tag)) return { prompt: 'E: close valve', key: tag, run: () => stopSource(world, tag) }
  return {
    prompt: 'E: open valve', key: tag,
    run: () => {
      addSource(world, 'water', at, VALVE_RATE, VALVE_SECONDS, tag)
      playSound(world, 'spray', at)
    },
  }
}

/** For guards and maintenance: shuts every open valve and stops every burst pipe within `reach` of a spot. */
export function shutValves(world: World, at: Vec, reach: number): number {
  const before = world.systems.sources.length
  world.systems.sources = world.systems.sources.filter((source) => source.kind !== 'water' || distance(source, at) > reach)
  return before - world.systems.sources.length
}

/** "Hold E: loosen gas fitting" at a stove or cylinder: a slow, quiet leak. */
export function gasFittingAction(world: World): SystemAction | null {
  const prop = nearestProp(world, GAS_FITTINGS)
  if (!prop || world.systems.spentProps.has(prop.id)) return null
  return {
    prompt: 'Hold E: loosen gas fitting', key: `gas:${prop.id}`, hold: LOOSEN_SECONDS,
    run: () => {
      world.systems.spentProps.add(prop.id)
      const at = propCenter(prop)
      startLeak(world, at, GAS_SECONDS)
      startSpray(world, { ...at, angle: -Math.PI / 2, spread: 0.3, reach: 1, kind: 'gas', life: GAS_SECONDS })
    },
  }
}

/** "E: open fuel tap" at a drum, generator or vehicle: a fuel trail starts to spread. */
export function fuelTapAction(world: World): SystemAction | null {
  const prop = nearestProp(world, FUEL_TAPS, REACH + 1)
  if (!prop || world.systems.spentProps.has(prop.id)) return null
  return { prompt: 'E: open fuel tap', key: `fuel:${prop.id}`, run: () => leakFuel(world, prop.id) }
}

/** "Hold E: pull down live cable" at conduit or a power box: a live cable hangs to the floor there. */
export function cableAction(world: World): SystemAction | null {
  const prop = nearestProp(world, CABLES, REACH + 1)
  if (!prop) return null
  const x = world.player.x + world.player.w / 2 + world.player.facing * 0.8
  if (world.systems.wires.some((wire) => Math.abs(wire.x - x) < 1)) return null
  return {
    prompt: 'Hold E: pull down live cable', key: `cable:${prop.id}`, hold: CABLE_SECONDS,
    run: () => {
      if (dropWire(world, x, world.player.y - 0.5, propCircuit(world, prop))) playSound(world, 'spark', { x, y: world.player.y })
    },
  }
}

/** "E: lights on a timer" at a light switch or fuse box: the circuit flips in ten seconds, sparking every fitting on it. */
export function timerAction(world: World): SystemAction | null {
  const hand = centerOf(world.player)
  const device = world.devices.find((candidate) => (candidate.kind === 'lightSwitch' || candidate.kind === 'fusebox') && !candidate.disabled
    && candidate.circuit !== undefined && distance({ x: candidate.x + 0.5, y: candidate.y + 0.5 }, hand) < REACH)
  if (!device || device.circuit === undefined || world.systems.timers.some((timer) => timer.circuit === device.circuit)) return null
  const circuit = device.circuit
  return { prompt: `E: set the lights on a ${TIMER_SECONDS} s timer`, key: `timer:${device.id}`, run: () => world.systems.timers.push({ circuit, left: TIMER_SECONDS }) }
}

/** "Hold E: wedge a bucket over the door": whoever opens it next gets it on the head, loudly. */
export function rigDoorAction(world: World): SystemAction | null {
  const hand = centerOf(world.player)
  for (let y = Math.floor(hand.y - REACH); y <= Math.floor(hand.y + REACH); y += 1) {
    for (let x = Math.floor(hand.x - REACH); x <= Math.floor(hand.x + REACH); x += 1) {
      if (tileAt(world.grid, x, y) !== 'door' || tileAt(world.grid, x, y + 1) === 'door') continue
      if (world.systems.rigged.some((door) => door.x === x && Math.abs(door.y - y) < 5)) return null
      return { prompt: 'Hold E: wedge a bucket over the door', key: `rig:${x}`, hold: RIG_SECONDS, run: () => world.systems.rigged.push({ x, y }) }
    }
  }
  return null
}

/** Timers count down; rigged doors that just opened drop their load on whoever is in the doorway. */
export function stepTraps(world: World, opened: readonly number[], dt: number): void {
  const systems = world.systems
  for (const timer of systems.timers) {
    timer.left -= dt
    if (timer.left > 0) continue
    if (world.deadCircuits.has(timer.circuit)) world.deadCircuits.delete(timer.circuit)
    else world.deadCircuits.add(timer.circuit)
  }
  systems.timers = systems.timers.filter((timer) => timer.left > 0)
  if (opened.length === 0 || systems.rigged.length === 0) return
  const width = world.grid.width
  for (const key of opened) {
    const x = key % width
    const y = (key - x) / width
    // Any tile of the door opening counts: doors open from wherever they were pushed.
    const door = systems.rigged.find((rigged) => rigged.x === x && y <= rigged.y && rigged.y - y < 6)
    if (door) slam(world, door)
  }
}

function slam(world: World, door: Vec): void {
  world.systems.rigged = world.systems.rigged.filter((rigged) => rigged !== door)
  const at = { x: door.x + 0.5, y: door.y + 0.5 }
  playSound(world, 'impact', at)
  emitNoise(world, at, SLAM_NOISE)
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || Math.abs(guard.x + guard.w / 2 - at.x) > 1.8 || Math.abs(guard.y + guard.h - at.y) > 2) continue
    stunGuard(guard, SLAM_STUN)
    hurtGuard(world, guard, SLAM_DAMAGE, at, 'hazard')
  }
}
