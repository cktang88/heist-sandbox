import { describe, expect, it } from 'vitest'
import { findUnsupported, slabRows } from './collapse'
import { findUnsupportedNear } from './collapseNear'
import { C4_BLAST, explode } from './explosions'
import { createRng } from './rng'
import { changeMark, changesFrom, createGrid, fillTiles, setTile, type Grid } from './tiles'
import { createWorld } from './world'

function changedSince(grid: Grid, mark: number): number[] {
  return grid.changes.tiles.slice(changesFrom(grid, mark))
}

describe('the local support check', () => {
  it('agrees with the whole-site check on random damage to the big site, and settles it locally', () => {
    const world = createWorld(1, 'complex')
    const { grid } = world
    const slabs = slabRows(world)
    const rng = createRng(7)
    let settled = 0
    let settledLoose = 0
    const rounds = 80
    for (let round = 0; round < rounds; round += 1) {
      const mark = changeMark(grid)
      if (round % 2 === 0) {
        // Holes of every size, in the tower and the buildings around it: from a few tiles to a storey's worth.
        for (let hole = Math.floor(rng() * 4); hole >= 0; hole -= 1) {
          const x = 60 + Math.floor(rng() * 180)
          const y = 20 + Math.floor(rng() * 140)
          const w = 1 + Math.floor(rng() * (rng() < 0.2 ? 30 : 6))
          const h = 1 + Math.floor(rng() * (rng() < 0.2 ? 8 : 3))
          for (let row = y; row < y + h; row += 1) for (let column = x; column < x + w; column += 1) setTile(grid, column, row, 'air')
        }
      } else {
        // C4 all along a room's floor, as the benchmark's big fight does. The room is drawn from the same random stream
        // rather than stepped through by index: stepping by a fixed stride ties which buildings get blown to how many
        // rooms the generator happens to make (with the tower's elevator cores it hit only tower rooms, held by their
        // slabs, so nothing was ever left loose to check).
        const room = world.rooms[Math.floor(rng() * world.rooms.length)]
        for (let x = room.x; x < room.x + room.w; x += 3) explode(world, { x: x + 0.5, y: room.floorY + 0.5 }, C4_BLAST)
      }
      const near = findUnsupportedNear(grid, slabs, changedSince(grid, mark))
      const whole = findUnsupported(grid, slabs)
      if (near) {
        expect(near).toEqual(whole)
        settled += 1
        if (whole.length > 0) settledLoose += 1
      }
      // What was loose falls away, so everything left is held, as after a step of play.
      for (const index of whole) setTile(grid, index % grid.width, Math.floor(index / grid.width), 'air')
    }
    expect(settled).toBeGreaterThan(rounds * 0.9)
    expect(settledLoose).toBeGreaterThan(0)
  })

  it('keeps a duct hanging from the slab above when the door under it opens, and drops it when the slab goes', () => {
    const grid = createGrid(12, 9)
    fillTiles(grid, 0, 8, 11, 8, 'bedrock')
    fillTiles(grid, 0, 1, 0, 7, 'reinforced')
    fillTiles(grid, 0, 1, 8, 1, 'concrete')
    fillTiles(grid, 4, 3, 8, 3, 'duct')
    fillTiles(grid, 8, 4, 8, 7, 'door')
    let mark = changeMark(grid)
    fillTiles(grid, 8, 4, 8, 7, 'air')
    expect(findUnsupportedNear(grid, [], changedSince(grid, mark))).toEqual([])
    mark = changeMark(grid)
    fillTiles(grid, 4, 1, 8, 1, 'air')
    expect(findUnsupportedNear(grid, [], changedSince(grid, mark))).toEqual(findUnsupported(grid))
    expect(findUnsupported(grid)).toHaveLength(5)
  })

  it('finds a piece cut off from the ground', () => {
    const grid = createGrid(8, 8)
    fillTiles(grid, 0, 7, 7, 7, 'bedrock')
    fillTiles(grid, 3, 1, 3, 6, 'brick')
    const mark = changeMark(grid)
    setTile(grid, 3, 4, 'air')
    expect(findUnsupportedNear(grid, [], changedSince(grid, mark))).toEqual([3 + 8, 3 + 16, 3 + 24])
  })

  it('keeps a floor piece held by a slab that still stands, and drops it once the slab is gone', () => {
    const grid = createGrid(12, 14)
    fillTiles(grid, 0, 13, 11, 13, 'bedrock')
    fillTiles(grid, 0, 1, 0, 12, 'reinforced')
    fillTiles(grid, 0, 6, 9, 6, 'concrete')
    const slabs = [{ y: 6, x0: 1, x1: 9, top: 0, bottom: 12 }]
    let mark = changeMark(grid)
    // A gap cuts the far end of the floor off from the wall, but the row still stands at the wall.
    setTile(grid, 4, 6, 'air')
    expect(findUnsupportedNear(grid, slabs, changedSince(grid, mark))).toEqual([])
    mark = changeMark(grid)
    fillTiles(grid, 1, 6, 3, 6, 'air')
    const near = findUnsupportedNear(grid, slabs, changedSince(grid, mark))
    expect(near).toEqual(findUnsupported(grid, slabs))
    expect(near).toHaveLength(5)
  })
})
