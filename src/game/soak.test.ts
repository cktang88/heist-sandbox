import { describe, expect, it } from 'vitest'
import { fastestPerCall, referenceWork } from './benchmark'
import { throwCharge } from './charges'
import { findUnsupported, slabRows } from './collapse'
import { damageProp } from './cover'
import { C4_BLAST, explode, ROCKET_BLAST } from './explosions'
import { throwFrag } from './frag/frag'
import { igniteAt, MAX_FIRES, MAX_SMOKE_CELLS, throwGrenade } from './hazards/hazards'
import { propBox, propsNear } from './hazards/props'
import { idleInput, type Input } from './input'
import { throwNearest } from './melee/throw'
import { boxHitsSolid } from './physics'
import { isPushable, isTable } from './physprops/kinds'
import { propsAround } from './physprops/nearby'
import { loosen } from './physprops/state'
import { kickProp } from './physprops/tip'
import { fireShot } from './projectiles'
import { propSpec } from './propCatalog'
import { stepWorld } from './step'
import { isSolidAt, TILE_KINDS } from './tiles'
import { centerOf, type Rect } from './types'
import { createWorld, type SiteKind, type World } from './world'

/**
 * Minutes of random destruction on a whole site: rockets, C4, frags, flashes, smoke, fire, bursting props, gunfire,
 * shoved and thrown furniture, uneven frame times. Every simulated second the world is checked for the things a
 * player would notice: numbers gone bad, things outside the map or stuck in walls, floating or vanished structure,
 * runaway counts and step cost.
 */

const FRAME = 1 / 60
/**
 * Step cost in reference workloads (see benchmark.ts). Measured on the complex: about 8 a frame on average and 23 to
 * 30 a frame over the worst second (70 guards thinking, fires, smoke, a floor coming down). Generous on purpose:
 * this catches runaway cost, not small slowdowns.
 */
const MEAN_FRAME_BUDGET = 40
const WORST_SECOND_BUDGET = 120

const inner = (box: Rect, margin: number): Rect => ({ x: box.x + margin, y: box.y + margin, w: box.w - 2 * margin, h: box.h - 2 * margin })

function frameReinforced(world: World): number[] {
  const reinforced = TILE_KINDS.indexOf('reinforced')
  const width = world.grid.width
  const found: number[] = []
  // Elevator car floors are reinforced and move with the car.
  world.grid.kinds.forEach((kind, index) => {
    const x = index % width
    if (kind === reinforced && !world.elevators.some((shaft) => x >= shaft.x && x < shaft.x + shaft.w)) found.push(index)
  })
  return found
}

function problems(world: World, frame: number[]): string[] {
  const found: string[] = []
  const { width, height } = world.grid
  const check = (what: string, x: number, y: number, ...rest: number[]) => {
    if (![x, y, ...rest].every(Number.isFinite)) found.push(`${what} not finite: ${[x, y, ...rest]}`)
    else if (x < -1 || y < -2 || x > width + 1 || y > height + 1) found.push(`${what} outside the map at ${x},${y}`)
  }
  const { player } = world
  check('player', player.x, player.y, player.vx, player.vy, player.hp)
  world.guards.forEach((guard, index) => {
    check(`guard ${index}`, guard.x, guard.y, guard.vx, guard.vy)
    guard.ragdoll?.points.forEach((point) => check(`ragdoll ${index}`, point.x, point.y, point.vx, point.vy))
    const hip = guard.ragdoll?.points[2]
    if (hip && isSolidAt(world.grid, hip.x, hip.y)) found.push(`ragdoll ${index} inside a wall at ${hip.x},${hip.y}`)
  })
  world.props.forEach((prop) => check(`prop ${prop.id}`, prop.x, prop.y))
  for (const thrown of [...world.frags, ...world.charges, ...world.hazards.grenades]) {
    check('thrown', thrown.x, thrown.y, thrown.vx, thrown.vy)
    if (!('stairs' in thrown && thrown.stairs) && boxHitsSolid(world.grid, thrown)) found.push(`thrown thing inside a wall at ${thrown.x},${thrown.y}`)
  }
  world.projectiles.forEach((shot) => check('projectile', shot.x, shot.y, shot.vx, shot.vy))
  world.falling.forEach((tile) => check('falling tile', tile.x, tile.y, tile.vy))
  for (const item of [world.loot, ...world.pickups]) {
    check('pickup', item.x, item.y, item.vy)
    if (!item.taken && boxHitsSolid(world.grid, item)) found.push(`pickup or loot inside a wall at ${item.x},${item.y}`)
  }
  // On the stairs a body crosses the slabs; mid-mantle it cuts the corner of the ledge.
  if (!player.stairs && !player.mantle && boxHitsSolid(world.grid, player)) found.push(`player inside a wall at ${player.x},${player.y}`)
  for (const loose of world.physProps.loose.values()) {
    const prop = world.props[loose.id]
    // Furniture falling through a hole only needs its footing to fit, so it may clip the edges on the way down.
    if (prop.broken || loose.flying || loose.vy !== 0) continue
    if (boxHitsSolid(world.grid, inner(propBox(prop), 0.05))) found.push(`loose ${prop.kind} inside a wall at ${prop.x},${prop.y}`)
  }
  const hazards = world.hazards
  if (hazards.fires.size > MAX_FIRES) found.push(`${hazards.fires.size} fires`)
  if ((hazards.smoke?.active.length ?? 0) > MAX_SMOKE_CELLS) found.push(`${hazards.smoke?.active.length} smoke cells`)
  if (world.projectiles.length > 2000) found.push(`${world.projectiles.length} projectiles`)
  if (world.effects.flashes.length > 2000) found.push(`${world.effects.flashes.length} flashes`)
  if (!world.structureChanged && world.falling.length === 0) {
    const loose = findUnsupported(world.grid, slabRows(world))
    if (loose.length > 0) found.push(`${loose.length} tiles floating, e.g. ${loose[0] % width},${Math.floor(loose[0] / width)}`)
  }
  const lost = frame.find((index) => TILE_KINDS[world.grid.kinds[index]] !== 'reinforced')
  if (lost !== undefined) found.push(`reinforced tile gone at ${lost % width},${Math.floor(lost / width)}`)
  return found
}

function randomInput(world: World): Input {
  const r = world.rng
  const aim = { x: world.player.x + (r() - 0.5) * 16, y: world.player.y + (r() - 0.5) * 10 }
  return {
    ...idleInput(aim),
    left: r() < 0.3, right: r() < 0.3, jumpPressed: r() < 0.05, jumpHeld: r() < 0.2, crouch: r() < 0.1,
    punchPressed: r() < 0.05, kickPressed: r() < 0.05, grab: r() < 0.3, throwPressed: r() < 0.03, fire: r() < 0.2, firePressed: r() < 0.1,
    selectTool: r() < 0.02 ? Math.floor(r() * 10) : null, interact: r() < 0.05,
  }
}

/** Something violent, once a simulated second, somewhere around the player. */
function mayhem(world: World): void {
  const r = world.rng
  const player = world.player
  const near = () => ({
    x: Math.min(world.grid.width - 2, Math.max(1, player.x + (r() - 0.5) * 30)),
    y: Math.min(world.grid.height - 2, Math.max(1, player.y + (r() - 0.5) * 20)),
  })
  const hand = () => ({ x: player.x + player.w / 2, y: player.y + 0.5 })
  const direction = () => ({ x: r() - 0.5, y: r() - 0.5 })
  if (r() < 0.25) bigDamage(world)
  const roll = r()
  if (roll < 0.2) explode(world, near(), r() < 0.5 ? ROCKET_BLAST : C4_BLAST)
  else if (roll < 0.3) throwGrenade(world, r() < 0.5 ? 'smoke' : 'flash', hand(), direction())
  else if (roll < 0.4) throwFrag(world, hand(), direction())
  else if (roll < 0.5) igniteAt(world, near(), r())
  else if (roll < 0.6) {
    for (let shot = 0; shot < 20; shot += 1) {
      fireShot(world, hand(), direction(), { kind: 'bullet', fromPlayer: r() < 0.5, speed: 60, damage: 30, tileDamage: 20, spread: 0.1, push: 2, penetration: 2 })
    }
  } else if (roll < 0.65) fireShot(world, hand(), direction(), { kind: 'rocket', fromPlayer: true, speed: 25, damage: 100, tileDamage: 100, spread: 0, push: 5 })
  else if (roll < 0.7) {
    throwCharge(world, hand(), direction())
    world.charges[world.charges.length - 1].fuse = 0.5
  } else if (roll < 0.8 && world.rooms.length > 0) {
    // On to another room, so the damage spreads over the site.
    const room = world.rooms[Math.floor(r() * world.rooms.length)]
    Object.assign(player, { x: room.x + room.w / 2, y: room.floorY - player.h - 0.01, vx: 0, vy: 0 })
  } else {
    for (const prop of propsAround(world, centerOf(player), 8)) {
      if (prop.broken || r() < 0.5) continue
      if (isPushable(prop.kind)) loosen(world, prop).vx = (r() - 0.5) * 8
      else if (isTable(prop.kind)) kickProp(world, prop, r() < 0.5 ? 1 : -1)
    }
    throwNearest(world, near())
  }
}

/** A whole floor levelled, an elevator shaft blasted, or every reactive prop around the player burst at once. */
function bigDamage(world: World): void {
  const r = world.rng
  const pick = r()
  if (pick < 0.3 && world.rooms.length > 0) {
    const room = world.rooms[Math.floor(r() * world.rooms.length)]
    for (let x = room.x; x < room.x + room.w; x += 3) explode(world, { x: x + 0.5, y: room.floorY + 0.5 }, C4_BLAST)
  } else if (pick < 0.5 && world.elevators.length > 0) {
    const shaft = world.elevators[Math.floor(r() * world.elevators.length)]
    explode(world, { x: shaft.x + 1, y: shaft.stops[Math.floor(r() * shaft.stops.length)] - 2 }, C4_BLAST)
  } else {
    for (const prop of propsNear(world, centerOf(world.player), 10)) if (propSpec(prop.kind).reacts && r() < 0.5) damageProp(world, prop, 1e4)
  }
}

function soak(seed: number, site: SiteKind, seconds: number): void {
  const world = createWorld(seed, site)
  const frame = frameReinforced(world)
  const reference = fastestPerCall(referenceWork, 20, 8)
  let total = 0
  let worstSecond = 0
  for (let second = 0; second < seconds; second += 1) {
    mayhem(world)
    let thisSecond = 0
    for (let step = 0; step < 60; step += 1) {
      world.player.hp = 1e9
      const roll = world.rng()
      // Mostly steady frames, with hitches (the longest frame main.ts allows) and near-frozen slow motion.
      const dt = roll < 0.1 ? 1 / 30 : roll < 0.15 ? 1e-5 : FRAME
      const input = randomInput(world)
      const started = performance.now()
      stepWorld(world, input, dt)
      thisSecond += performance.now() - started
      world.sounds.length = 0
    }
    total += thisSecond
    worstSecond = Math.max(worstSecond, thisSecond)
    const found = problems(world, frame)
    if (found.length > 0) throw new Error(`seed ${seed} ${site}, second ${second}: ${found.slice(0, 6).join('; ')}`)
  }
  const meanFrame = total / (seconds * 60) / reference
  const worstFrame = worstSecond / 60 / reference
  expect(meanFrame).toBeLessThan(MEAN_FRAME_BUDGET)
  expect(worstFrame).toBeLessThan(WORST_SECOND_BUDGET)
}

describe('a long soak of random destruction', () => {
  it.each([1, 2])('keeps the complex sound for a minute and a half (seed %i)', (seed) => soak(seed, 'complex', 90), 300_000)
  it('keeps the outpost sound for a minute and a half', () => soak(4, 'outpost', 90), 300_000)
})
