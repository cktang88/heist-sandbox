import type { World } from '../world'
import { circuitLive } from './circuits'
import type { Fall, FallingFitting, LiquidKind } from './state'

/**
 * What the couplings look like, for the renderer: standing water and fuel, streams pouring off edges and out of
 * pipes, live water and cables, fittings coming down. Read-only, and allocation-free where called every frame.
 */
export type LiquidVisit = (x: number, y: number, depth: number, kind: LiquidKind) => void

/** Every tile of standing water and fuel. */
export function eachPuddle(world: World, visit: LiquidVisit): void {
  const width = world.grid.width
  for (const field of [world.systems.water, world.systems.fuel]) {
    if (!field || field.size !== world.grid.kinds.length) continue
    for (const key of field.active) {
      const x = key % width
      visit(x, (key - x) / width, field.depth[key], field.kind)
    }
  }
}

/** Streams that poured during the last liquid tick. */
export function eachStream(world: World, visit: (fall: Fall) => void): void {
  for (const field of [world.systems.water, world.systems.fuel]) for (const fall of field?.falls ?? []) visit(fall)
}

/** Tiles of water carrying current right now. */
export function eachLiveTile(world: World, visit: (x: number, y: number) => void): void {
  const width = world.grid.width
  for (const key of world.systems.energized.keys()) {
    const x = key % width
    visit(x, (key - x) / width)
  }
}

export type WireView = { x: number; top: number; bottom: number; live: boolean }

export function wireViews(world: World): WireView[] {
  return world.systems.wires.map((wire) => ({ x: wire.x, top: wire.top, bottom: wire.y + 1, live: circuitLive(world, wire.circuit) }))
}

export function fallingFittings(world: World): readonly FallingFitting[] {
  return world.systems.falling
}
