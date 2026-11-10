import { describe, expect, it } from 'vitest'
import { findUnsupported } from './collapse'
import { hurtTile } from './destruction'
import { idleInput } from './input'
import { createLevel } from './level'
import { stepWorld } from './step'
import { createGrid, fillTiles, setTile, tileAt } from './tiles'
import { createWorld } from './world'

describe('collapse', () => {
  it.each([1, 2, 3, 42])('leaves the untouched level of seed %i standing', (seed) => {
    expect(findUnsupported(createLevel(seed).grid)).toEqual([])
  })

  it('finds tiles cut off from the ground', () => {
    const grid = createGrid(6, 6)
    fillTiles(grid, 0, 5, 5, 5, 'bedrock')
    fillTiles(grid, 2, 1, 2, 4, 'brick')
    expect(findUnsupported(grid)).toEqual([])
    setTile(grid, 2, 3, 'air')
    expect(findUnsupported(grid).length).toBe(2)
  })

  it('drops a cut-off chunk and lets it land as tiles again', () => {
    const world = createWorld(1)
    world.guards = []
    Object.assign(world.player, { x: 5, y: 37, hp: 1e6 })
    // A free-standing pillar on the street, then knock out its base.
    for (let y = 34; y <= 39; y += 1) setTile(world.grid, 40, y, 'brick')
    hurtTile(world, 40, 39, 1000)
    hurtTile(world, 40, 38, 1000)
    for (let frame = 0; frame < 120; frame += 1) stepWorld(world, idleInput(), 1 / 60)
    expect(world.falling.length).toBe(0)
    expect(tileAt(world.grid, 40, 39)).toBe('brick')
    expect(tileAt(world.grid, 40, 36)).toBe('brick')
    expect(tileAt(world.grid, 40, 35)).toBe('air')
  })
})
