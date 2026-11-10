import { describe, expect, it } from 'vitest'
import { damageProp } from '../cover'
import { startFire } from '../hazards/fire'
import { startLeak } from '../hazards/gas'
import { addSmoke, gasAt } from '../hazards/smoke'
import { addProp, bareWorld } from '../hazards/testWorld'
import { fillTiles, setTile } from '../tiles'
import type { World } from '../world'
import { fanAction, setFan } from './fans'
import { ignitionSourceAt, lightCigarette } from './ignition'
import { liquidAt } from './liquid'
import { addRoomOf, freshSystems, runAll } from './testKit'

/** A kitchen (rows 15..21, floor on row 22) under an office (rows 9..13, floor on row 14), joined by a hole at 20-21. */
function kitchenBelowOffice(): World {
  const world = freshSystems(bareWorld(60, 24))
  fillTiles(world.grid, 1, 8, 58, 8, 'concrete')
  fillTiles(world.grid, 1, 14, 58, 14, 'concrete')
  fillTiles(world.grid, 20, 14, 21, 14, 'air')
  fillTiles(world.grid, 41, 9, 41, 21, 'concrete')
  addRoomOf(world, 'office', 2, 9, 39, 5)
  addRoomOf(world, 'kitchen', 2, 15, 39, 7)
  return world
}

describe('gas, air and fuel', () => {
  it('a kitchen leak drifts up through a hole, and the lights coming on upstairs set it off', () => {
    const world = kitchenBelowOffice()
    world.lamps.push({ x: 21.5, y: 9.2, fixture: 'fluorescentTube', color: 0xffffff, radius: 6, strength: 1, hung: true, circuit: 7 })
    world.deadCircuits.add(7)
    // Two burners left on.
    startLeak(world, { x: 17, y: 21 }, 30)
    startLeak(world, { x: 18, y: 21 }, 30)
    runAll(world, 30)
    expect(gasAt(world, 21, 9)).toBeGreaterThan(0.05)
    expect(ignitionSourceAt(world, { x: 21.5, y: 9.5 })).toBe(false)
    world.deadCircuits.delete(7)
    runAll(world, 0.1)
    expect(gasAt(world, 21, 9)).toBe(0)
  })

  it('a guard lighting a cigarette in gas sets it off', () => {
    const world = kitchenBelowOffice()
    startLeak(world, { x: 10, y: 21 }, 6)
    runAll(world, 6)
    expect(lightCigarette(world, { x: 10.5, y: 20.5 })).toBe(true)
    expect(gasAt(world, 10, 20)).toBe(0)
  })

  it('opening the door of a shut, smoke-packed burning room makes it flare out through the doorway', () => {
    const world = freshSystems(bareWorld(60, 24))
    fillTiles(world.grid, 1, 16, 58, 16, 'concrete')
    fillTiles(world.grid, 30, 17, 30, 21, 'door')
    startFire(world, 24, 21, 1, 60)
    for (let y = 17; y <= 21; y += 1) for (let x = 20; x <= 29; x += 1) addSmoke(world, x, y, 2, 'toxic')
    runAll(world, 0.1)
    fillTiles(world.grid, 30, 17, 30, 21, 'air')
    runAll(world, 0.1)
    // Flame rolls out of the top of the doorway, into the corridor beyond.
    expect([...world.hazards.fires.values()].some((fire) => fire.x >= 32)).toBe(true)
  })

  it('a fan blowing toward the doorway pushes the gas out of a room', () => {
    const gasInKitchen = (world: World) => {
      let total = 0
      for (let y = 15; y <= 21; y += 1) for (let x = 2; x <= 40; x += 1) total += gasAt(world, x, y)
      return total
    }
    const leaking = () => {
      const world = kitchenBelowOffice()
      // A doorway in the kitchen's right wall onto open ground.
      fillTiles(world.grid, 41, 15, 41, 21, 'air')
      startLeak(world, { x: 30, y: 21 }, 3)
      runAll(world, 3)
      return world
    }
    const world = leaking()
    const still = leaking()
    const unit = addProp(world, 'wallAc', 34, 18, 1)
    Object.assign(world.player, { x: unit.x, y: 22 - world.player.h, vx: 0, vy: 0 })
    fanAction(world)!.run()
    expect(world.systems.fans.get(1)).toBe('extract')
    setFan(world, 1, 'right')
    runAll(world, 10)
    runAll(still, 10)
    expect(gasInKitchen(world)).toBeLessThan(gasInKitchen(still) * 0.6)
  })

  it('a shot car leaks a fuel trail; a flame at the end of it runs back and cooks the car off', () => {
    const world = freshSystems(bareWorld(60, 24))
    const car = addProp(world, 'car', 10, 22)
    damageProp(world, car, 20)
    runAll(world, 12)
    expect(liquidAt(world, 'fuel', 15, 21)).toBeGreaterThan(0)
    setTile(world.grid, 0, 0, 'bedrock')
    startFire(world, 16, 21, 1, 2)
    let cooking = false
    runAll(world, 6, () => {
      if (world.hazards.cooking.has(car.id) || car.broken) cooking = true
    })
    expect(cooking).toBe(true)
  })
})
