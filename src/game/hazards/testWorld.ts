import type { PropState } from '../cover'
import { createGuard, type Guard } from '../guards'
import { propSpec, type PropKind } from '../propCatalog'
import type { Room } from '../site'
import { createGrid, fillTiles, type TileKind } from '../tiles'
import { createWorld, type World } from '../world'
import { createHazards, stepHazards } from './hazards'

/**
 * Test helpers: a bare world with an empty grid walled in bedrock, a concrete ground slab on row `height - 2`,
 * no guards, props or rooms, and a player parked out of the way.
 */
export function bareWorld(width = 60, height = 24, seed = 1): World {
  const world = createWorld(seed)
  const grid = createGrid(width, height)
  fillTiles(grid, 0, 0, width - 1, 0, 'bedrock')
  fillTiles(grid, 0, height - 1, width - 1, height - 1, 'bedrock')
  fillTiles(grid, 0, 0, 0, height - 1, 'bedrock')
  fillTiles(grid, width - 1, 0, width - 1, height - 1, 'bedrock')
  fillTiles(grid, 1, height - 2, width - 2, height - 2, 'concrete')
  Object.assign(world, { grid, guards: [], props: [], rooms: [], lamps: [], devices: [], interiors: [], stairwells: [], elevators: [], elevatorCars: [], pickups: [] })
  Object.assign(world.player, { x: 1.2, y: height - 3.7, hp: 1e6 })
  world.hazards = createHazards()
  return world
}

/** A closed concrete box whose open inside spans columns x0..x1 and rows y0..y1. */
export function box(world: World, x0: number, y0: number, x1: number, y1: number, kind: TileKind = 'concrete'): void {
  fillTiles(world.grid, x0 - 1, y0 - 1, x1 + 1, y1 + 1, kind)
  fillTiles(world.grid, x0, y0, x1, y1, 'air')
}

export function addProp(world: World, kind: PropKind, x: number, y: number, roomId?: number): PropState {
  const prop: PropState = { kind, x, y, id: world.props.length, hp: propSpec(kind).hp, broken: false, roomId }
  world.props.push(prop)
  return prop
}

export function addGuard(world: World, x: number, floorY: number, facing: 1 | -1): Guard {
  const guard = createGuard({ x, y: floorY, facing })
  world.guards.push(guard)
  return guard
}

export function addRoom(world: World, x: number, y: number, w: number, h: number): Room {
  const room: Room = { id: world.rooms.length, x, y, w, h, kind: 'office', building: 'test', storey: 0, floorY: y + h, security: 0 }
  world.rooms.push(room)
  return room
}

/** Steps only the hazards, at 60 frames a second. `each` runs after every frame. */
export function run(world: World, seconds: number, each?: () => void): void {
  for (let frame = 0; frame < Math.round(seconds * 60); frame += 1) {
    stepHazards(world, 1 / 60)
    each?.()
  }
}
