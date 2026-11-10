import { describe, expect, it } from 'vitest'
import { damageProp } from '../cover'
import { C4_BLAST, explode } from '../explosions'
import { startLeak } from '../hazards/gas'
import { igniteAt, MAX_FIRES, MAX_SMOKE_CELLS } from '../hazards/hazards'
import { idleInput } from '../input'
import { fireShot } from '../projectiles'
import { stepWorld } from '../step'
import { createWorld, type World } from '../world'
import { MAX_LIQUID_CELLS } from './liquid'
import { MAX_SOURCES } from './sources'
import { cableAction, fuelTapAction, valveAction } from './actions'

/**
 * Every chain reaction at once on a whole site, for minutes: pipes and fixtures burst, gas leaks, fuel taps open,
 * live cables pulled down, fires lit, blasts. The couplings' fields must stay within their caps, agree with each other
 * every second, and, once everything that feeds them has stopped, die away rather than leave hazards with no source.
 */
const FRAME = 1 / 60

/** A random storey of a random building: its rooms on the complex, the one building's storeys on the outpost. */
function somewhere(world: World): { x: number; w: number; floorY: number } {
  const r = world.rng
  if (world.rooms.length > 0) return world.rooms[Math.floor(r() * world.rooms.length)]
  const building = world.interiors.find((area) => area.kind === 'room')!
  return { x: building.x + 1, w: building.w - 2, floorY: building.y + 6 * (1 + Math.floor(r() * (building.h / 6))) }
}

function chaos(world: World): void {
  const r = world.rng
  const room = somewhere(world)
  const spot = { x: room.x + r() * room.w, y: room.floorY - 0.5 - r() * 3 }
  Object.assign(world.player, { x: spot.x - world.player.w / 2, y: room.floorY - world.player.h - 0.01, vx: 0, vy: 0 })
  const roll = r()
  if (roll < 0.15) explode(world, spot, C4_BLAST)
  else if (roll < 0.3) igniteAt(world, spot, r())
  else if (roll < 0.4) startLeak(world, spot, 10)
  else if (roll < 0.6) {
    for (let shot = 0; shot < 12; shot += 1) {
      fireShot(world, spot, { x: r() - 0.5, y: r() - 0.5 }, { kind: 'bullet', fromPlayer: true, speed: 60, damage: 30, tileDamage: 20, spread: 0.2, push: 1, penetration: 3 })
    }
  } else if (roll < 0.8) {
    for (const action of [valveAction(world), fuelTapAction(world), cableAction(world)]) action?.run()
  } else {
    for (const prop of world.props) if (!prop.broken && Math.abs(prop.x - spot.x) < 6 && Math.abs(prop.y - room.floorY) < 1 && r() < 0.3) damageProp(world, prop, 1e4)
  }
}

function problems(world: World): string[] {
  const found: string[] = []
  const systems = world.systems
  if (world.hazards.fires.size > MAX_FIRES) found.push('fires over cap')
  if ((world.hazards.smoke?.active.length ?? 0) > MAX_SMOKE_CELLS) found.push('smoke over cap')
  for (const field of [systems.water, systems.fuel]) {
    if (!field) continue
    if (field.active.length > MAX_LIQUID_CELLS) found.push(`${field.kind} over cap`)
    for (const key of field.active) {
      if (!Number.isFinite(field.depth[key]) || field.depth[key] < 0 || field.depth[key] > 5) found.push(`${field.kind} depth ${field.depth[key]}`)
    }
  }
  if (systems.sources.length > MAX_SOURCES) found.push('sources over cap')
  if (systems.wires.length > 16) found.push('wires over cap')
  for (const key of systems.energized.keys()) if (!systems.water?.live[key]) found.push(`energized dry tile ${key}`)
  return found.slice(0, 5)
}

function soak(seed: number, site: 'outpost' | 'complex', seconds: number): World {
  const world = createWorld(seed, site)
  world.guards = []
  for (let second = 0; second < seconds; second += 1) {
    chaos(world)
    for (let frame = 0; frame < 60; frame += 1) {
      world.player.hp = 1e9
      stepWorld(world, idleInput(), FRAME)
      world.sounds.length = 0
    }
    const found = problems(world)
    if (found.length > 0) throw new Error(`seed ${seed}, second ${second}: ${found.join('; ')}`)
  }
  return world
}

describe('all the chain reactions at once', () => {
  it.each([1, 2, 3])('stay bounded and consistent on the outpost (seed %i), and die away once nothing feeds them', (seed) => {
    const world = soak(seed, 'outpost', 60)
    // Everything that feeds them stops: taps shut, leaks spent, power cut everywhere.
    world.systems.sources = []
    world.hazards.leaks = []
    for (let quiet = 0; quiet < 240; quiet += 1) {
      for (let frame = 0; frame < 60; frame += 1) {
        world.player.hp = 1e9
        stepWorld(world, idleInput(), FRAME)
        world.sounds.length = 0
      }
      const found = problems(world)
      if (found.length > 0) throw new Error(`seed ${seed}, quiet second ${quiet}: ${found.join('; ')}`)
    }
    expect(world.hazards.fires.size).toBe(0)
    expect(world.hazards.smoke?.gasCells ?? 0).toBe(0)
    expect(world.hazards.sprays.filter((spray) => spray.life > 60)).toEqual([])
    expect(world.systems.energized.size).toBe(0)
  }, 1_200_000)

  it.each([1, 2])('stay bounded and consistent on the complex (seed %i)', (seed) => {
    const world = soak(seed, 'complex', 45)
    expect(world.systems.sources.length + world.hazards.fires.size).toBeGreaterThan(0)
  }, 1_200_000)
})
