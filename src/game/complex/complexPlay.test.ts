import { describe, expect, it } from 'vitest'
import { idleInput, type Input } from '../input'
import { stepWorld } from '../step'
import { createWorld, type World } from '../world'

const FRAME = 1 / 60

function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += FRAME) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y }), ...input }, FRAME)
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

  it('sends a hunting guard up the stairs to the floor the player was seen on', () => {
    const { world, well } = atTowerStairs(3)
    const guard = createWorld(1, 'complex').guards[0]
    Object.assign(guard, {
      x: well.leftX + 6, y: well.stops[3] - guard.h - 0.01, vx: 0, vy: 0, state: 'alert', awareness: 1, lostSeconds: 999,
      target: { x: well.leftX + 4, y: well.stops[7] - 0.8 }, role: 'patrol',
    })
    world.guards = [guard]
    world.alarm = true
    Object.assign(world.player, { x: 5, y: world.groundY - 1.7 })
    let highest = well.stops[3]
    for (let frame = 0; frame < 60 * 20; frame += 1) {
      guard.target = { x: well.leftX + 4, y: well.stops[7] - 0.8 }
      stepWorld(world, idleInput(), FRAME)
      highest = Math.min(highest, guard.y + guard.h)
    }
    expect(highest).toBeLessThanOrEqual(well.stops[7] + 0.5)
  })

  it('survives thirty seconds of the whole site running', () => {
    const world = createWorld(3, 'complex')
    world.player.hp = 1e6
    run(world, 30, { jumpHeld: true, right: true })
    expect(Number.isFinite(world.player.x)).toBe(true)
    expect(world.guards.every((guard) => Number.isFinite(guard.x) && Number.isFinite(guard.y))).toBe(true)
  })
})
