import type { PropState } from '../cover'
import { burst } from '../effects'
import { breakProp } from '../hazards/reactions'
import { igniteGasNear } from '../hazards/gas'
import { startFire } from '../hazards/fire'
import { propById, propsAt } from '../hazards/props'
import { emitNoise } from '../noise'
import type { PropKind } from '../propCatalog'
import { propSpec } from '../propCatalog'
import { playSound } from '../sounds'
import type { Vec } from '../types'
import type { World } from '../world'
import { circuitLive, propCircuit } from './circuits'
import { liquidAt } from './liquid'

/**
 * Live things in water. Plant (transformers, switchgear, street boxes, generators), electronics standing in a
 * puddle, and live cables hanging into one energise every tile of water joined to them: anyone standing there is
 * shocked. Electronics short out after a soak, which can throw sparks into gas. The breaker on that circuit trips
 * after a moment, the room goes dark and the water is safe, until somebody throws the breaker back on.
 */
const PLANT: ReadonlySet<PropKind> = new Set(['transformer', 'switchgear', 'powerBox', 'generator'])
const ELECTRONICS: ReadonlySet<PropKind> = new Set([
  'serverRack', 'consoleCart', 'vendingMachine', 'arcadeCabinet', 'tvStand', 'securityDesk', 'radioStation', 'coolingUnit',
  'workLight', 'fridge', 'coffeeMachine', 'printer', 'kiosk', 'treadmill', 'centrifuge',
])
const TOUCHES = 0.02
/** Seconds a circuit stays earthed through water before its breaker trips. */
export const TRIP_SECONDS = 1.5
/** Kit with no breaker (on the street supply) burns itself out after this long earthed instead. */
const BURN_OUT_SECONDS = 6
/** Seconds of soaking before electronics short out. */
const SHORT_SECONDS = 2
const MAX_PUDDLE = 600
const SPARK = '#bfe4ff'

/** Floor kit that carries current, standing with its base in row `y`. */
function isKitBasedIn(prop: PropState | undefined, y: number): prop is PropState {
  return !!prop && !prop.broken && (PLANT.has(prop.kind) || ELECTRONICS.has(prop.kind)) && propSpec(prop.kind).mount === 'floor' && prop.y - 1 === y
}

/** Live kit and cables touching water this tick: the wet tile, the circuit, and the prop (or -1 for a cable). */
type Contact = { key: number; circuit: number | undefined; prop: number }

function contacts(world: World): Contact[] {
  const found: Contact[] = []
  const field = world.systems.water
  const width = world.grid.width
  if (field && field.active.length > 0) {
    for (const key of field.active) {
      if (field.depth[key] < TOUCHES) continue
      const x = key % width
      const y = (key - x) / width
      // The shared prop index follows props that fall or are dragged: kit dropped into a flooded room is live there.
      for (const id of propsAt(world, x, y)) {
        const prop = propById(world, id)
        if (!isKitBasedIn(prop, y)) continue
        const circuit = propCircuit(world, prop)
        if (circuitLive(world, circuit) && !found.some((contact) => contact.prop === id)) found.push({ key, circuit, prop: id })
      }
    }
  }
  for (const wire of world.systems.wires) {
    if (!circuitLive(world, wire.circuit)) continue
    const x = Math.floor(wire.x)
    if (liquidAt(world, 'water', x, wire.y) >= TOUCHES) found.push({ key: wire.y * width + x, circuit: wire.circuit, prop: -1 })
  }
  return found
}

/** Every water tile joined to a start tile along the floor. */
function puddleFrom(world: World, start: number, visit: (key: number) => void): void {
  const field = world.systems.water!
  const seen = new Set<number>([start])
  const queue = [start]
  while (queue.length > 0 && seen.size < MAX_PUDDLE) {
    const key = queue.pop()!
    visit(key)
    for (const next of [key - 1, key + 1]) {
      if (seen.has(next) || !field.live[next] || field.depth[next] < TOUCHES) continue
      seen.add(next)
      queue.push(next)
    }
  }
}

/** One electrical tick: works out which water is live, soaks and shorts electronics, trips breakers. */
export function stepElectric(world: World, tick: number): void {
  const systems = world.systems
  systems.energized.clear()
  if (!systems.water?.active.length) {
    systems.earthing.clear()
    systems.soaking.clear()
    return
  }
  const earthed = new Map<number | undefined, number>()
  for (const contact of contacts(world)) {
    if (!earthed.has(contact.circuit)) earthed.set(contact.circuit, contact.key)
    puddleFrom(world, contact.key, (key) => systems.energized.set(key, contact.circuit))
    arc(world, contact.key)
    if (contact.prop >= 0) soak(world, contact.prop, tick)
  }
  for (const circuit of [...systems.earthing.keys()]) if (!earthed.has(circuit)) systems.earthing.delete(circuit)
  for (const [circuit, key] of earthed) {
    const seconds = (systems.earthing.get(circuit) ?? 0) + tick
    systems.earthing.set(circuit, seconds)
    if (circuit !== undefined && seconds >= TRIP_SECONDS) trip(world, circuit, key)
    else if (circuit === undefined && seconds >= BURN_OUT_SECONDS) burnOut(world)
  }
}

/** Current meeting water crackles and spits, which lights any gas or fuel right there. */
function arc(world: World, key: number): void {
  const width = world.grid.width
  const at: Vec = { x: (key % width) + 0.5, y: Math.floor(key / width) + 0.8 }
  if (world.systems.rng() < 0.5) burst(world.effects, world.systems.rng, at, 4, SPARK, 5)
  igniteGasNear(world, at, 1.2)
  if (liquidAt(world, 'fuel', key % width, Math.floor(key / width)) > 0) startFire(world, key % width, Math.floor(key / width), 0.9)
}

function soak(world: World, id: number, tick: number): void {
  const prop = propById(world, id)
  if (!prop || !ELECTRONICS.has(prop.kind)) return
  const seconds = (world.systems.soaking.get(id) ?? 0) + tick
  world.systems.soaking.set(id, seconds)
  if (seconds >= SHORT_SECONDS) shortProp(world, prop)
}

/** Electronics ruined by water: a bang of sparks, and kit that sparks when broken does so. */
function shortProp(world: World, prop: PropState): void {
  world.systems.soaking.delete(prop.id)
  breakProp(world, prop)
  playSound(world, 'spark', { x: prop.x + 0.5, y: prop.y - 1 })
}

/** The breaker on a circuit trips: lights out on that floor, a clunk the guards hear, and the water is safe. */
function trip(world: World, circuit: number, key: number): void {
  world.deadCircuits.add(circuit)
  world.systems.earthing.delete(circuit)
  const box = world.devices.find((device) => device.kind === 'fusebox' && device.circuit === circuit)
  const width = world.grid.width
  const at = box ? { x: box.x + 0.5, y: box.y + 0.5 } : { x: (key % width) + 0.5, y: Math.floor(key / width) + 0.5 }
  playSound(world, 'switch', at)
  emitNoise(world, at, 4)
}

/** Street-supply kit earthed too long burns out, since nothing upstream will trip. */
function burnOut(world: World): void {
  world.systems.earthing.delete(undefined)
  for (const contact of contacts(world)) {
    if (contact.circuit !== undefined) continue
    const prop = contact.prop >= 0 ? propById(world, contact.prop) : undefined
    if (prop) breakProp(world, prop)
    else world.systems.wires = world.systems.wires.filter((wire) => wire.circuit !== undefined)
  }
}
