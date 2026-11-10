import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../input'
import { stepWorld } from '../step'
import { createWorld, type World } from '../world'

const FRAME = 1 / 60

function run(world: World, seconds: number, input: Partial<Input> = {}, each?: () => void): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
    each?.()
  }
}

/** The complex with no guards, and the player standing at a landing of the tower's main stairs. */
function atTowerStairs(stop: number): { world: World; well: World['stairwells'][number] } {
  const world = createWorld(1, 'complex')
  world.guards = []
  const well = world.stairwells.find((candidate) => candidate.building === 'tower')!
  const x = stop % 2 === 0 ? well.leftX : well.rightX
  Object.assign(world.player, { x: x - world.player.w / 2, y: well.stops[stop] - world.player.h - 0.01, vx: 0, vy: 0, hp: 1e6 })
  run(world, 0.2)
  return { world, well }
}

describe('playing in the complex', () => {
  it('lets the player climb the tower stairs floor after floor by holding up', () => {
    const { world, well } = atTowerStairs(3)
    expect(world.player.onGround).toBe(true)
    run(world, 6, { up: true })
    const feet = world.player.y + world.player.h
    expect(feet).toBeLessThan(well.stops[6])
    run(world, 1.5)
    expect(world.player.stairs).toBeNull()
    expect(well.stops.some((stop) => Math.abs(stop - (world.player.y + world.player.h)) < 0.1)).toBe(true)
  })

  it('lets the player walk down a flight and step off at the landing', () => {
    const { world, well } = atTowerStairs(5)
    run(world, 0.2, { down: true })
    expect(world.player.stairs).not.toBeNull()
    run(world, 3)
    expect(world.player.stairs).toBeNull()
    expect(world.player.y + world.player.h).toBeCloseTo(well.stops[4], 0)
  })

  it('sends a searching guard up the stairs to the floor the player was last reported on', () => {
    const { world, well } = atTowerStairs(3)
    const guard = createWorld(1, 'complex').guards[0]
    const goal = { x: well.leftX + 4, y: well.stops[7] }
    Object.assign(guard, {
      x: well.leftX + 6, y: well.stops[3] - guard.h - 0.01, vx: 0, vy: 0, mode: 'searching', state: 'suspicious', role: 'patrol',
      search: { points: [goal], index: 0, dwell: 0, endsAt: 1e9 },
    })
    world.guards = [guard]
    Object.assign(world.player, { x: 5, y: world.groundY - 1.7 })
    let highest = well.stops[3]
    let usedStairs = false
    run(world, 20, {}, () => {
      highest = Math.min(highest, guard.y + guard.h)
      usedStairs ||= guard.stairs !== null
    })
    expect(usedStairs).toBe(true)
    expect(highest).toBeLessThanOrEqual(well.stops[7] + 0.5)
  })

  it('walks a calm patrol along its route and back without leaving its floor', () => {
    const world = createWorld(1, 'complex')
    const guard = world.guards.find((other) => other.role === 'patrol' && other.route.length >= 2 && other.roomId !== null)!
    world.guards = [guard]
    Object.assign(world.player, { x: 5, y: world.groundY - 1.7, hp: 1e6 })
    const floor = guard.home.y
    const [a, b] = guard.route
    let nearA = false
    let nearB = false
    run(world, 90, {}, () => {
      const x = guard.x + guard.w / 2
      nearA ||= Math.abs(x - a.x) < 1
      nearB ||= Math.abs(x - b.x) < 1
    })
    expect(nearA && nearB).toBe(true)
    expect(guard.mode).toBe('calm')
    expect(Math.abs(guard.y + guard.h - floor) < 0.1 || guard.detour !== null || guard.stairs !== null).toBe(true)
  })

  it('runs thirty seconds of the whole guarded site quickly and stays finite', () => {
    const world = createWorld(3, 'complex')
    world.player.hp = 1e6
    const started = performance.now()
    run(world, 30, { jumpHeld: true, right: true })
    const seconds = (performance.now() - started) / 1000
    expect(world.guards.length).toBeGreaterThan(60)
    expect(seconds).toBeLessThan(10)
    expect(Number.isFinite(world.player.x)).toBe(true)
    expect(world.guards.every((guard) => Number.isFinite(guard.x) && Number.isFinite(guard.y))).toBe(true)
  })
})
