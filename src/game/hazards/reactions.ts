import { circuitOf } from '../complex/kit'
import type { PropState } from '../cover'
import { burst } from '../effects'
import { currentBlastCause, explode, type Blast } from '../explosions'
import { propSpec, type PropKind } from '../propCatalog'
import { roomAt } from '../site'
import { playSound } from '../sounds'
import type { Vec } from '../types'
import type { World } from '../world'
import { startFire } from './fire'
import { igniteGasNear, startLeak } from './gas'
import { propBox, propById, propCenter } from './props'
import { burstSpray, startSpray } from './sprays'

/**
 * Blasts are scaled to the prop: a barrel is about a rocket, a gas cylinder smaller (it also throws a jet of flame),
 * machines and vehicles bigger. Numbers are literal rather than built from explosions.ts constants, which are not
 * ready yet when this module loads (the two modules import each other).
 */
const BLASTS: Partial<Record<PropKind, Blast>> = {
  explosiveBarrel: { radius: 3.4, tileDamage: 260, bodyDamage: 160 },
  gasCylinder: { radius: 2.6, tileDamage: 170, bodyDamage: 120 },
  ammoLocker: { radius: 3.6, tileDamage: 300, bodyDamage: 170 },
  generator: { radius: 4.2, tileDamage: 420, bodyDamage: 200 },
  boiler: { radius: 4.6, tileDamage: 480, bodyDamage: 230 },
  car: { radius: 4.4, tileDamage: 380, bodyDamage: 210 },
  van: { radius: 4.8, tileDamage: 420, bodyDamage: 230 },
  truck: { radius: 5.4, tileDamage: 480, bodyDamage: 250 },
}
const DEFAULT_BLAST: Blast = { radius: 3, tileDamage: 200, bodyDamage: 140 }
/** Electrical kit whose breaking trips its room's lighting circuit. */
const ELECTRICAL: ReadonlySet<PropKind> = new Set(['transformer', 'switchgear', 'powerBox', 'serverRack', 'generator'])
const MIN_FUSE = 0.1
const FUSE_SPREAD = 0.15
const LEAK_SECONDS = 12
const JET_LENGTH = 4

/** Breaks a prop and lets it react. Safe to call more than once. */
export function breakProp(world: World, prop: PropState): void {
  prop.broken = true
  if (Number.isFinite(prop.hp)) prop.hp = Math.min(prop.hp, 0)
  propBroke(world, prop)
}

/** A prop was destroyed: barrels blow, extinguishers burst, stoves leak, electrics spark. Each prop reacts once. */
export function propBroke(world: World, prop: PropState): void {
  const hazards = world.hazards
  if (hazards.reacted.has(prop.id)) return
  hazards.reacted.add(prop.id)
  hazards.burningProps.delete(prop.id)
  prop.broken = true
  const spec = propSpec(prop.kind)
  const center = propCenter(prop)
  if (spec.reacts === 'explodes') primeBlast(world, prop, center)
  else if (spec.reacts === 'sparks') throwSparks(world, center)
  else if (spec.reacts === 'gas') leakGas(world, prop, center)
  else if (spec.reacts === 'sprays') burstSpray(world, prop, center)
  if (ELECTRICAL.has(prop.kind)) cutPower(world, prop, center)
}

function primeBlast(world: World, prop: PropState, center: Vec): void {
  world.hazards.blasts.push({ ...center, fuse: MIN_FUSE + world.rng() * FUSE_SPREAD, blast: BLASTS[prop.kind] ?? DEFAULT_BLAST, prop: prop.id, cause: currentBlastCause() })
}

/** Sets off primed props whose fuse has run out. The explosion itself damages the props around it (cover.ts), which is how chains ripple. */
export function stepBlasts(world: World, dt: number): void {
  const hazards = world.hazards
  if (hazards.blasts.length === 0) return
  for (const pending of hazards.blasts) pending.fuse -= dt
  const due = hazards.blasts.filter((pending) => pending.fuse <= 0)
  hazards.blasts = hazards.blasts.filter((pending) => pending.fuse > 0)
  for (const pending of due) {
    const at = { x: pending.x, y: pending.y }
    if (propById(world, pending.prop)?.kind === 'gasCylinder') flameJet(world, at)
    explode(world, at, pending.blast, pending.cause)
  }
}

/** A ruptured cylinder throws a tongue of flame up and to one side before it goes. */
function flameJet(world: World, at: Vec): void {
  const side = world.rng() < 0.5 ? -1 : 1
  for (let step = 0; step < JET_LENGTH; step += 1) {
    startFire(world, Math.floor(at.x + side * step * 0.7), Math.floor(at.y - step * 0.7), 1, 0.6)
  }
  startSpray(world, { ...at, angle: side > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4, spread: 0.25, reach: JET_LENGTH, kind: 'gas', life: 0.4 })
}

function throwSparks(world: World, center: Vec): void {
  burst(world.effects, world.rng, center, 18, '#ffd36b', 10)
  playSound(world, 'spark', center)
  igniteGasNear(world, center, 2.5)
  if (world.rng() < 0.5) startFire(world, Math.floor(center.x), Math.floor(center.y), 0.5)
}

function leakGas(world: World, prop: PropState, center: Vec): void {
  const box = propBox(prop)
  const mouth = { x: center.x, y: box.y + 0.2 }
  startLeak(world, mouth, LEAK_SECONDS)
  startSpray(world, { ...mouth, angle: -Math.PI / 2, spread: 0.3, reach: 1.5, kind: 'gas', life: LEAK_SECONDS })
  playSound(world, 'spray', mouth)
}

function cutPower(world: World, prop: PropState, center: Vec): void {
  const room = (prop.roomId !== undefined ? world.rooms.find((other) => other.id === prop.roomId) : undefined) ?? roomAt(world.rooms, center.x, center.y)
  if (room) world.deadCircuits.add(circuitOf(room.building, room.storey))
}
