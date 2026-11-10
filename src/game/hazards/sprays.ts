import type { PropState } from '../cover'
import type { PropKind } from '../propCatalog'
import { reportEvent } from '../security/dispatch'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { nearestFire } from './fire'
import { propById, propCenter, sprinklersInRoom } from './props'
import { addSmoke, thinSmoke } from './smoke'
import { tileKey, type Spray, type SprayKind } from './state'

/** How each kind of burst prop sprays. `aim` 'side' picks left or right, pointing down and outward. */
type SprayPlan = { kind: SprayKind; aim: number | 'side'; spread: number; reach: number; life: number }
const DOWN = Math.PI / 2
const UP = -Math.PI / 2
const SPRINKLER: SprayPlan = { kind: 'water', aim: DOWN, spread: 0.8, reach: 5.5, life: 10 }
const PLANS: Partial<Record<PropKind, SprayPlan>> = {
  fireExtinguisher: { kind: 'foam', aim: 'side', spread: 0.5, reach: 4, life: 3 },
  sprinkler: SPRINKLER,
  fireHydrant: { kind: 'water', aim: UP, spread: 0.3, reach: 5, life: 6 },
  waterTank: { kind: 'water', aim: 'side', spread: 0.5, reach: 4, life: 6 },
  roofWaterTank: { kind: 'water', aim: 'side', spread: 0.5, reach: 4, life: 6 },
  specimenTank: { kind: 'water', aim: 'side', spread: 0.6, reach: 3, life: 3 },
}
const WET_SECONDS = 40
/** Share of smoke left per second under a water spray: it knocks smoke down a little, not away. */
const SMOKE_KEPT_PER_SECOND = 0.3
/** A room must burn this long before its sprinklers open. */
const SPRINKLER_DELAY = 2
const FOAM_RADIUS = 1.5
const FOAM_BLIND_SECONDS = 1.5

export function startSpray(world: World, spray: Spray): void {
  world.hazards.sprays.push(spray)
}

/** A burst tank, hydrant, sprinkler head or extinguisher. */
export function burstSpray(world: World, prop: PropState, center: Vec): void {
  const plan = PLANS[prop.kind] ?? SPRINKLER
  startSpray(world, { ...center, angle: aimOf(world, plan, center), spread: plan.spread, reach: plan.reach, kind: plan.kind, life: plan.life })
  playSound(world, 'spray', center)
  if (prop.kind === 'fireExtinguisher') foamPuff(world, center)
}

/** A loose jet whips toward whatever burns nearby (that is why you shoot an extinguisher), otherwise to a random side. */
function aimOf(world: World, plan: SprayPlan, from: Vec): number {
  if (plan.aim !== 'side') return plan.aim
  return aimAtFire(world, from, plan.reach) ?? (world.rng() < 0.5 ? DOWN - 1 : DOWN + 1)
}

function aimAtFire(world: World, from: Vec, reach: number): number | null {
  const fire = nearestFire(world, from, reach + 1)
  return fire ? Math.atan2(fire.y - from.y, fire.x - from.x) : null
}

/** A shot extinguisher bursts into a cloud of powder: blinding for a moment, gone in a second or two. */
function foamPuff(world: World, at: Vec): void {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) addSmoke(world, Math.floor(at.x) + dx, Math.floor(at.y) + dy, dx === 0 && dy === 0 ? 3 : 1.5, 'foam')
  }
  const people = [world.player, ...world.guards.filter((guard) => guard.state !== 'dead')]
  for (const person of people) {
    if (distance(centerOf(person), at) <= FOAM_RADIUS) person.blindSeconds = Math.max(person.blindSeconds, FOAM_BLIND_SECONDS)
  }
}

export function stepSprays(world: World, dt: number): void {
  const hazards = world.hazards
  if (hazards.sprays.length === 0) return
  for (const spray of hazards.sprays) spray.life -= dt
  hazards.sprays = hazards.sprays.filter((spray) => spray.life > 0)
}

/** Water and foam put out fire in their cone, wet what they hit, and thin the smoke. Wet tiles dry off slowly. */
export function soak(world: World, tick: number): void {
  const hazards = world.hazards
  for (const [key, left] of hazards.wet) {
    if (left <= tick) hazards.wet.delete(key)
    else hazards.wet.set(key, left - tick)
  }
  const keep = Math.pow(SMOKE_KEPT_PER_SECOND, tick)
  for (const spray of hazards.sprays) {
    if (spray.kind !== 'water' && spray.kind !== 'foam') continue
    // A loose extinguisher whips about and keeps finding the flames.
    if (spray.kind === 'foam') spray.angle = aimAtFire(world, spray, spray.reach) ?? spray.angle
    for (const tile of coneTiles(world, spray)) {
      const key = tileKey(world, tile.x, tile.y)
      if (hazards.fires.delete(key)) addSmoke(world, tile.x, tile.y, 0.3, 'screen')
      hazards.wet.set(key, WET_SECONDS)
      // The floor under the spray gets wet too.
      if (isSolidAt(world.grid, tile.x, tile.y + 1)) hazards.wet.set(tileKey(world, tile.x, tile.y + 1), WET_SECONDS)
      thinSmoke(world, tile.x, tile.y, keep)
    }
  }
}

/** Tiles inside a spray's cone that the spray can reach without passing through anything solid. */
function coneTiles(world: World, spray: Spray): Vec[] {
  const tiles: Vec[] = []
  const reach = Math.ceil(spray.reach)
  const startX = Math.floor(spray.x)
  const startY = Math.floor(spray.y)
  for (let y = startY - reach; y <= startY + reach; y += 1) {
    for (let x = startX - reach; x <= startX + reach; x += 1) {
      const target = { x: x + 0.5, y: y + 0.5 }
      const gap = Math.hypot(target.x - spray.x, target.y - spray.y)
      if (gap > spray.reach) continue
      if (gap > 0.8 && angleOff(Math.atan2(target.y - spray.y, target.x - spray.x), spray.angle) > spray.spread) continue
      if (pathClear(world, spray, target, gap)) tiles.push({ x, y })
    }
  }
  return tiles
}

/** The size of the angle between two directions, 0..PI. */
function angleOff(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

/** Is the way from a spray to a tile open? The tile itself may be solid: a wooden wall still gets wet. */
function pathClear(world: World, from: Vec, to: Vec, gap: number): boolean {
  const steps = Math.floor(gap / 0.4)
  for (let step = 1; step < steps; step += 1) {
    const along = step / steps
    const x = from.x + (to.x - from.x) * along
    const y = from.y + (to.y - from.y) * along
    if (Math.floor(x) === Math.floor(to.x) && Math.floor(y) === Math.floor(to.y)) break
    if (isSolidAt(world.grid, x, y)) return false
  }
  return true
}

/** Rooms that have burnt long enough open their sprinkler heads and ring the fire alarm. */
export function runSprinklers(world: World, burningRooms: ReadonlySet<number>, tick: number): void {
  const hazards = world.hazards
  for (const [room, left] of hazards.sprinkling) {
    if (left <= tick) hazards.sprinkling.delete(room)
    else hazards.sprinkling.set(room, left - tick)
  }
  for (const room of hazards.roomFire.keys()) if (!burningRooms.has(room)) hazards.roomFire.delete(room)
  for (const room of burningRooms) {
    const burnt = (hazards.roomFire.get(room) ?? 0) + tick
    hazards.roomFire.set(room, burnt)
    if (burnt >= SPRINKLER_DELAY && !hazards.sprinkling.has(room)) openSprinklers(world, room)
  }
}

function openSprinklers(world: World, room: number): void {
  const heads = sprinklersInRoom(world, room).map((id) => propById(world, id)).filter((prop): prop is PropState => prop !== undefined && !prop.broken)
  if (heads.length === 0) return
  world.hazards.sprinkling.set(room, SPRINKLER.life)
  for (const head of heads) {
    const center = propCenter(head)
    startSpray(world, { ...center, angle: DOWN, spread: SPRINKLER.spread, reach: SPRINKLER.reach, kind: 'water', life: SPRINKLER.life })
  }
  const first = propCenter(heads[0])
  playSound(world, 'spray', first)
  reportEvent(world, { kind: 'fire', at: first, alarm: true })
}

export function isWetAt(world: World, at: Vec): boolean {
  return world.hazards.wet.has(tileKey(world, Math.floor(at.x), Math.floor(at.y)))
}
