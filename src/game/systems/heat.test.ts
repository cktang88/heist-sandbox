import { describe, expect, it } from 'vitest'
import { startFire } from '../hazards/fire'
import { addProp, bareWorld } from '../hazards/testWorld'
import { fillTiles, tileAt } from '../tiles'
import { doorTooHot } from './heat'
import { freshSystems, runAll } from './testKit'

describe('heat and structure', () => {
  it('a long fire burns through the concrete floor under it', () => {
    const world = freshSystems(bareWorld(40, 24))
    fillTiles(world.grid, 1, 14, 38, 14, 'concrete')
    let seconds = 0
    runAll(world, 90, () => {
      // Kept fed, like a pile of furniture burning down.
      if (tileAt(world.grid, 20, 14) === 'concrete') seconds += 1 / 60
      startFire(world, 20, 13, 1, 1)
    })
    expect(tileAt(world.grid, 20, 14)).toBe('air')
    expect(seconds).toBeGreaterThan(30)
  })

  it('fire cracks the window beside it and leaves the door beside it too hot to touch for a while', () => {
    const world = freshSystems(bareWorld(40, 24))
    fillTiles(world.grid, 10, 17, 10, 21, 'glass')
    fillTiles(world.grid, 14, 17, 14, 21, 'door')
    runAll(world, 8, () => {
      startFire(world, 11, 21, 1, 1)
      startFire(world, 13, 21, 1, 1)
    })
    expect(tileAt(world.grid, 10, 21)).toBe('air')
    expect(doorTooHot(world, { x: 14, y: 21 })).toBe(true)
    world.hazards.fires.clear()
    runAll(world, 30)
    expect(doorTooHot(world, { x: 14, y: 21 })).toBe(false)
  })

  it('a gas cylinder sitting in fire hisses a warning before it goes off', () => {
    const world = freshSystems(bareWorld(40, 24))
    const cylinder = addProp(world, 'gasCylinder', 20, 22)
    let hissedFirst = false
    runAll(world, 8, () => {
      if (!cylinder.broken) startFire(world, 20, 21, 1, 1)
      if (!cylinder.broken && world.hazards.sprays.some((spray) => spray.kind === 'steam')) hissedFirst = true
    })
    expect(hissedFirst).toBe(true)
    expect(cylinder.broken).toBe(true)
  })
})
