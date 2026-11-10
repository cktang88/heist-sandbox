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
    ...level,
    grid,
    playerStart: { ...level.playerStart, x: tile(level.playerStart.x) },
    extraction: { ...level.extraction, x: point(level.extraction.x) - level.extraction.w },
    loot: { ...level.loot, x: tile(level.loot.x) },
    guards: level.guards.map((guard) => ({ ...guard, x: tile(guard.x), facing: guard.facing === 1 ? -1 : 1, route: guard.route?.map((stop) => ({ ...stop, x: tile(stop.x) })) })),
    interiors: level.interiors.map((area) => ({ ...area, x: point(area.x) - area.w })),
    lamps: level.lamps.map((lamp) => ({ ...lamp, x: point(lamp.x) })),
    // A model faces the other way too, or a chair would turn its back on its desk.
    props: level.props.map((prop) => ({ ...prop, x: tile(prop.x), flip: !prop.flip })),
    pickups: level.pickups.map((pickup) => ({ ...pickup, x: tile(pickup.x) })),
    rooms: level.rooms.map((room) => ({ ...room, x: point(room.x) - room.w })),
    stairwells: level.stairwells.map((well) => ({
      ...well, leftX: point(well.rightX), rightX: point(well.leftX), stops: well.stops,
      ...(well.bounds && { bounds: {
        ...well.bounds, x0: tile(well.bounds.x1), x1: tile(well.bounds.x0),
        splits: well.bounds.splits?.map((split) => ({ ...split, from: tile(split.to), to: tile(split.from) })),
      } }),
    })),
    elevators: level.elevators.map((shaft) => ({ ...shaft, x: point(shaft.x) - shaft.w, doorSide: shaft.doorSide === 1 ? -1 : 1 })),
    devices: level.devices.map((device) => ({ ...device, x: tile(device.x), facing: device.facing === undefined ? undefined : device.facing === 1 ? -1 : 1,
      target: typeof device.target === 'object' ? { x: tile(device.target.x), y: device.target.y } : device.target,
    })),
  }
}
