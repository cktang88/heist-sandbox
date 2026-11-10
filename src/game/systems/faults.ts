import { burst } from '../effects'
import { addGas } from '../hazards/smoke'
import { igniteGasNear } from '../hazards/gas'
import { propBox, propById, propCenter } from '../hazards/props'
import { startSpray } from '../hazards/sprays'
import { lampIsLit } from '../light'
import type { Lamp, Room } from '../site'
import { playSound } from '../sounds'
import type { World } from '../world'
import { dropFitting } from './hanging'
import { addSource } from './sources'
import type { Fault } from './state'
import { ceilingPipeBox, hasCeilingPipe, targetIndex } from './targets'

/**
 * The site's own accidents waiting to happen, seeded from the heist seed: a ceiling pipe dripping into a puddle, a
 * failing tube that flickers and spits sparks, a gas ring left on in a kitchen, a loose ceiling fan or chandelier that
 * a loud bang (or time) brings down. Each is visible to an observant player, and dangerous or useful to either side.
 * A fault wakes when the player first comes within sight range and runs from then on: one nobody is near does nothing
 * yet, which keeps a quiet site free.
 */
const ODDS = { leak: 0.5, sparkingLamp: 0.45, gasRing: 0.35, looseFitting: 0.45 }
const DRIP_RATE = 0.06
const FOREVER = 1e9
const GAS_RING_RATE = 0.05
const SPARK_EVERY = { min: 2, max: 7 }
const LOOSE_AFTER = { min: 90, max: 600 }
const BANG_REACH = 14
const WAKE_RANGE = { x: 50, y: 30 }
const KITCHENS: ReadonlySet<Room['kind']> = new Set(['kitchen', 'cafeteria', 'breakRoom'])
const TUBES: ReadonlySet<Lamp['fixture']> = new Set(['fluorescentTube', 'bareBulb', 'ceilingPanel'])

function pick<T>(world: World, items: readonly T[]): T | undefined {
  return items.length > 0 ? items[Math.floor(world.systems.rng() * items.length)] : undefined
}

function roll(world: World, odds: number): boolean {
  return world.systems.rng() < odds
}

/** Decides the site's faults once, at the first step, when the site is complete. */
export function seedFaults(world: World): void {
  const systems = world.systems
  systems.faultsSeeded = true
  const add = (fault: Fault | null) => fault && systems.faults.push(fault)
  if (roll(world, ODDS.leak)) add(leak(world))
  if (roll(world, ODDS.sparkingLamp)) add(sparkingLamp(world))
  if (roll(world, ODDS.gasRing)) add(gasRing(world))
  if (roll(world, ODDS.looseFitting)) add(looseFitting(world))
}

function leak(world: World): Fault | null {
  const room = pick(world, world.rooms.filter(hasCeilingPipe))
  if (!room) return null
  const box = ceilingPipeBox(room)
  const at = { x: box.x + 1 + world.systems.rng() * Math.max(1, box.w - 2), y: box.y + box.h }
  return { ...at, kind: 'leak', lamp: null, prop: -1, clock: 0, awake: false }
}

function sparkingLamp(world: World): Fault | null {
  const lamp = pick(world, world.lamps.filter((candidate) => candidate.circuit !== undefined && TUBES.has(candidate.fixture)))
  if (!lamp) return null
  return { x: lamp.x, y: lamp.y, kind: 'sparkingLamp', lamp, prop: -1, clock: nextSpark(world), awake: false }
}

function gasRing(world: World): Fault | null {
  const kitchens = new Set(world.rooms.filter((room) => KITCHENS.has(room.kind)).map((room) => room.id))
  const stove = pick(world, world.props.filter((prop) => prop.kind === 'stove' && prop.roomId !== undefined && kitchens.has(prop.roomId)))
  if (!stove) return null
  const top = { x: propCenter(stove).x, y: propBox(stove).y + 0.2 }
  return { ...top, kind: 'gasRing', lamp: null, prop: stove.id, clock: 0, awake: false }
}

function looseFitting(world: World): Fault | null {
  const target = pick(world, targetIndex(world).all.filter((candidate) => candidate.kind === 'lamp'
    || (candidate.kind === 'fitting' && propById(world, candidate.prop)?.kind === 'ceilingFan')))
  if (!target) return null
  const { box } = target
  const after = LOOSE_AFTER.min + world.systems.rng() * (LOOSE_AFTER.max - LOOSE_AFTER.min)
  return { x: box.x + box.w / 2, y: box.y, kind: 'looseFitting', lamp: target.lamp, prop: target.prop, clock: after, awake: false }
}

/** Wakes a fault once the player is near enough to see it: the drip starts, the tube flickers, the ring hisses. */
function wake(world: World, fault: Fault): boolean {
  const player = world.player
  if (Math.abs(player.x - fault.x) > WAKE_RANGE.x || Math.abs(player.y - fault.y) > WAKE_RANGE.y) return false
  fault.awake = true
  if (fault.kind === 'leak') addSource(world, 'water', fault, DRIP_RATE, FOREVER, 'fault:leak')
  if (fault.kind === 'sparkingLamp' && fault.lamp) fault.lamp.flickers = true
  if (fault.kind === 'gasRing') startSpray(world, { x: fault.x, y: fault.y, angle: -Math.PI / 2, spread: 0.2, reach: 0.6, kind: 'gas', life: FOREVER })
  return true
}

function nextSpark(world: World): number {
  return SPARK_EVERY.min + world.systems.rng() * (SPARK_EVERY.max - SPARK_EVERY.min)
}

/** The faults at work: the gas ring hisses on, the bad tube sparks, the loose fitting waits for a bang. */
export function stepFaults(world: World, tick: number): void {
  for (const fault of world.systems.faults) {
    if (!fault.awake && !wake(world, fault)) continue
    if (fault.kind === 'gasRing') addGas(world, Math.floor(fault.x), Math.floor(fault.y), GAS_RING_RATE * tick)
    else if (fault.kind === 'sparkingLamp') sparkLamp(world, fault, tick)
    else if (fault.kind === 'looseFitting') shakeLoose(world, fault, tick)
  }
  world.systems.faults = world.systems.faults.filter((fault) => fault.clock > -1)
}

function sparkLamp(world: World, fault: Fault, tick: number): void {
  fault.clock -= tick
  if (fault.clock > 0 || !fault.lamp) return
  fault.clock = nextSpark(world)
  if (!lampIsLit(world, fault.lamp)) return
  burst(world.effects, world.systems.rng, fault, 5, '#ffe08a', 4)
  playSound(world, 'spark', fault)
  igniteGasNear(world, fault, 1.5)
}

/** A loose fitting comes down after a while, or straight away when something goes bang nearby. */
function shakeLoose(world: World, fault: Fault, tick: number): void {
  fault.clock -= tick
  const bang = world.effects.flashes.some((flash) => flash.kind === 'explosion' && Math.hypot(flash.x - fault.x, flash.y - fault.y) < BANG_REACH)
  if (fault.clock > 0 && !bang) return
  const target = targetIndex(world).all.find((candidate) => (fault.lamp ? candidate.lamp === fault.lamp : candidate.prop === fault.prop))
  if (target) dropFitting(world, target)
  fault.clock = -2
}
