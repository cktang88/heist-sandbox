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

  it('keeps a duct hanging from the slab above when the door it rests on is opened, and drops it when the slab goes', () => {
    const grid = createGrid(12, 9)
    fillTiles(grid, 0, 8, 11, 8, 'bedrock')
    fillTiles(grid, 0, 1, 0, 7, 'reinforced')
    // A slab on row 1 held by the left wall, a duct on row 3, and a door under the duct's far end.
    fillTiles(grid, 0, 1, 8, 1, 'concrete')
    fillTiles(grid, 4, 3, 8, 3, 'duct')
    fillTiles(grid, 8, 4, 8, 7, 'door')
    fillTiles(grid, 8, 4, 8, 7, 'air')
    expect(findUnsupported(grid)).toEqual([])
    fillTiles(grid, 4, 1, 8, 1, 'air')
    expect(findUnsupported(grid).length).toBe(5)
  })

  it('opening every door a duct passes over on the complex never brings a duct down', () => {
    const world = createWorld(1, 'complex')
    let opened = 0
    for (let y = 0; y < world.grid.height; y += 1) {
      for (let x = 0; x < world.grid.width; x += 1) {
        if (tileAt(world.grid, x, y) !== 'duct') continue
        for (let below = y + 1; below <= y + 3; below += 1) {
          if (tileAt(world.grid, x, below) !== 'door') continue
          setTile(world.grid, x, below, 'air')
          opened += 1
        }
      }
    }
    expect(opened).toBeGreaterThan(10)
    const loose = findUnsupported(world.grid).map((index) => tileAt(world.grid, index % world.grid.width, Math.floor(index / world.grid.width)))
    expect(loose.filter((kind) => kind === 'duct')).toEqual([])
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
