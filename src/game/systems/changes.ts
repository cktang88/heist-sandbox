import { changeMark, changesFrom, TILE_DEFS, TILE_KINDS } from '../tiles'
import type { World } from '../world'

/**
 * Tiles that opened up since last frame (a door swung open, a wall or ceiling blown out), read from the grid's change
 * list. Shared by the couplings that care: fittings left hanging from nothing, doors opening onto smoke, rigged doors.
 */
const SOLID = Uint8Array.from(TILE_KINDS, (kind) => (TILE_DEFS[kind].solid ? 1 : 0))
const opened: number[] = []

export function openedTiles(world: World): readonly number[] {
  const systems = world.systems
  const grid = world.grid
  opened.length = 0
  if (systems.changeGrid !== grid) {
    systems.changeGrid = grid
    systems.changeMark = changeMark(grid)
    return opened
  }
  const from = changesFrom(grid, systems.changeMark)
  systems.changeMark = changeMark(grid)
  if (from < 0) return opened
  const tiles = grid.changes.tiles
  for (let index = from; index < tiles.length; index += 1) if (!SOLID[grid.kinds[tiles[index]]]) opened.push(tiles[index])
  return opened
}
