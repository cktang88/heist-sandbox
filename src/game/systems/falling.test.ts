import { describe, expect, it } from 'vitest'
import { isLampShot } from '../ballistics/lampState'
import { addGuard, addProp, bareWorld } from '../hazards/testWorld'
import { propSpec } from '../propCatalog'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { handbrakeAction } from './rolling'
import { freshSystems, runAll, shoot } from './testKit'

/** A room with its ceiling slab on row 16 and floor slab on row 22. */
function room(): World {
  const world = freshSystems(bareWorld(60, 24))
  fillTiles(world.grid, 1, 16, 58, 16, 'concrete')
  return world
}

describe('things that fall and roll', () => {
  it('shooting through a ceiling fan brings it down on the guard under it', () => {
    const world = room()
    const fan = addProp(world, 'ceilingFan', 20, 17)
    const guard = addGuard(world, 19.7, 22, 1)
    shoot(world, 22, 17.25, -60, 0)
    runAll(world, 1.5)
    expect(fan.broken).toBe(true)
    expect(fan.y + propSpec('ceilingFan').h).toBeCloseTo(22, 0)
    expect(guard.hp).toBeLessThan(100)
    expect(guard.stunSeconds).toBeGreaterThan(0)
  })

  it('a shot chandelier falls, goes dark and lands on whoever is below', () => {
    const world = room()
    const lamp = { x: 30.5, y: 17.3, fixture: 'chandelier' as const, color: 0xffffff, radius: 6, strength: 1, hung: true }
    world.lamps.push(lamp)
    const guard = addGuard(world, 30.2, 22, 1)
    shoot(world, 31.8, 17.7, -60, 0)
    runAll(world, 1.5)
    expect(isLampShot(world, lamp)).toBe(true)
    expect(guard.hp).toBeLessThan(100)
  })

  it('a fitting falls when the ceiling it hangs from is blown away', () => {
    const world = room()
    const fan = addProp(world, 'ceilingFan', 20, 17)
    runAll(world, 0.1)
    fillTiles(world.grid, 18, 16, 22, 16, 'air')
    runAll(world, 1.5)
    expect(fan.broken).toBe(true)
  })

  it('a car with its handbrake off rolls down a guard and stoves itself in against a wall', () => {
    const world = room()
    const car = addProp(world, 'car', 10, 22)
    const guard = addGuard(world, 17, 22, 1)
    fillTiles(world.grid, 26, 17, 26, 21, 'concrete')
    Object.assign(world.player, { x: 6.5, y: 22 - world.player.h, vx: 0, vy: 0 })
    const action = handbrakeAction(world)
    expect(action?.hold).toBeGreaterThan(0)
    action!.run()
    runAll(world, 6)
    expect(guard.stunSeconds).toBeGreaterThan(0)
    expect(car.x).toBeGreaterThan(20)
    expect(car.hp).toBeLessThan(propSpec('car').hp)
  })
})
