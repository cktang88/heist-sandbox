import { bareWorld } from '../hazards/testWorld'
import { idleInput, type Input } from '../input'
import { stepWorld } from '../step'
import { fillTiles } from '../tiles'
import { handOf } from '../tools'
import { normalize } from '../vision'
import type { Vec } from '../types'
import type { World } from '../world'
import { fireGrapple } from './hook'

export const FRAME = 1 / 60
export const STREET = 38
export const WALL = 30
export const ROOF = 12
/** A storey inside the building: floor on row 22, open rows 17-21, the window in the outer wall on rows 18-20. */
export const FLOOR = 22
export const WINDOW_TOP = 18
export const WINDOW_BOTTOM = 20

/**
 * Test helpers: a concrete building whose outer wall is column 30 (roof on row 12, street on row 38), with one room
 * on rows 17-21 behind a three-row glass window, like the facade the complex generator builds. The player stands
 * in the street to the left.
 */
export function buildingWorld(seed = 1): World {
  const world = bareWorld(70, 40, seed)
  fillTiles(world.grid, WALL, ROOF, 60, STREET - 1, 'concrete')
  fillTiles(world.grid, WALL + 1, FLOOR - 5, 50, FLOOR - 1, 'air')
  fillTiles(world.grid, WALL, WINDOW_TOP, WALL, WINDOW_BOTTOM, 'glass')
  world.rooms = [{ id: 0, kind: 'office', building: 'test', storey: 2, x: WALL + 1, y: FLOOR - 5, w: 20, h: 5, floorY: FLOOR, security: 0 }]
  standAt(world, 20, STREET)
  return world
}

export function standAt(world: World, x: number, feetRow: number): void {
  Object.assign(world.player, { x: x - world.player.w / 2, y: feetRow - world.player.h - 0.001, vx: 0, vy: 0, onGround: true, hp: 1e6 })
}

/** Runs the whole game loop with the aim parked to the right of the player unless the input says otherwise. */
export function run(world: World, seconds: number, input: Partial<Input> = {}): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    stepWorld(world, { ...idleInput({ x: world.player.x + 5, y: world.player.y + 1 }), ...input }, FRAME)
  }
}

/** Shoots the hook at a point and lets it fly until it bites or comes back. */
export function shootAt(world: World, target: Vec): void {
  const hand = handOf(world)
  fireGrapple(world, hand, normalize(target.x - hand.x, target.y - hand.y))
  for (let frame = 0; frame < 60 && (world.grapple.phase === 'flying' || world.grapple.phase === 'retracting'); frame += 1) run(world, FRAME)
}
