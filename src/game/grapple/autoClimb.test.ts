import { describe, expect, it } from 'vitest'
import { bareWorld } from '../hazards/testWorld'
import { boxHitsSolid } from '../physics'
import { fillTiles } from '../tiles'
import { actionIndex, toolIndex } from '../toolDefs'
import { findZipTarget } from './autoClimb'
import { FRAME, run, standAt } from './testWorld'

/** Two storeys of a building: a lower room with its floor on row 30 and an upper room with its floor on row 24. */
function twoStoreys() {
  const world = bareWorld(60, 40, 1)
  fillTiles(world.grid, 0, 0, 59, 39, 'concrete')
  fillTiles(world.grid, 5, 25, 50, 29, 'air')
  fillTiles(world.grid, 5, 19, 50, 23, 'air')
  world.player.tool = actionIndex('grapple')
  return world
}

describe('E with the grapple in hand', () => {
  it('hauls the player up through a hole in the ceiling onto the floor above', () => {
    const world = twoStoreys()
    fillTiles(world.grid, 20, 24, 22, 24, 'air')
    standAt(world, 21.5, 30)
    run(world, 0.2)
    expect(world.prompt).toBe('E: grapple up')
    run(world, FRAME, { interact: true, interactPressed: true })
    expect(world.grapple.zip).toBe(true)
    run(world, 2)
    expect(world.player.y + world.player.h).toBeCloseTo(24, 1)
    expect(world.player.mantle).toBeNull()
    expect(world.grapple.zip).toBe(false)
    expect(['retracting', 'stowed']).toContain(world.grapple.phase)
  })

  it('climbs onto a ledge overhead to the side', () => {
    const world = bareWorld(60, 40, 1)
    fillTiles(world.grid, 0, 30, 59, 39, 'concrete')
    fillTiles(world.grid, 25, 25, 40, 29, 'concrete')
    world.player.tool = actionIndex('grapple')
    standAt(world, 22, 30)
    run(world, 0.2)
    run(world, FRAME, { interact: true, interactPressed: true })
    run(world, 2)
    expect(world.player.y + world.player.h).toBeCloseTo(25, 1)
    expect(world.player.x).toBeGreaterThan(24.5)
  })

  it('offers nothing under a solid ceiling, or without the grapple equipped', () => {
    const world = twoStoreys()
    standAt(world, 21.5, 30)
    run(world, 0.2)
    expect(findZipTarget(world)).toBeNull()
    fillTiles(world.grid, 20, 24, 22, 24, 'air')
    world.player.tool = toolIndex('pistol')
    run(world, 0.2)
    expect(world.prompt).not.toBe('E: grapple up')
  })

  it('goes straight up through the hole before stepping across, never through the floor beside it', () => {
    const world = twoStoreys()
    fillTiles(world.grid, 20, 24, 22, 24, 'air')
    standAt(world, 21.5, 30)
    // The cursor on the floor a few columns past the hole picks a landing well to the side.
    const aim = { x: 27.5, y: 23 }
    run(world, 0.2, { aim })
    run(world, FRAME, { interact: true, interactPressed: true, aim })
    expect(world.player.mantle?.to.x).toBeGreaterThan(25)
    for (let frame = 0; frame < 120 && world.player.mantle; frame += 1) {
      run(world, FRAME, { aim })
      expect(boxHitsSolid(world.grid, world.player)).toBe(false)
    }
    expect(world.player.y + world.player.h).toBeCloseTo(24, 1)
  })
})
