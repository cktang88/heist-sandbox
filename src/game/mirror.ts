import type { Level } from './level'
import { createGrid } from './tiles'

/** Flips a level left-to-right, so half of all heists approach the building from the other side. */
export function mirrorLevel(level: Level): Level {
  const { width, height } = level.grid
  const grid = createGrid(width, height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      grid.kinds[y * width + (width - 1 - x)] = level.grid.kinds[y * width + x]
      grid.hp[y * width + (width - 1 - x)] = level.grid.hp[y * width + x]
    }
  }
  const tile = (x: number) => width - 1 - x
  const point = (x: number) => width - x
  return {
    grid,
    playerStart: { ...level.playerStart, x: tile(level.playerStart.x) },
    extraction: { ...level.extraction, x: point(level.extraction.x) - level.extraction.w },
    loot: { ...level.loot, x: tile(level.loot.x) },
    guards: level.guards.map((guard) => ({ ...guard, x: tile(guard.x), facing: guard.facing === 1 ? -1 : 1 })),
    interiors: level.interiors.map((area) => ({ ...area, x: point(area.x) - area.w })),
    lamps: level.lamps.map((lamp) => ({ ...lamp, x: point(lamp.x) })),
    props: level.props.map((prop) => ({ ...prop, x: tile(prop.x) })),
    pickups: level.pickups.map((pickup) => ({ ...pickup, x: tile(pickup.x) })),
  }
}
