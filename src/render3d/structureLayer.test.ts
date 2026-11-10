import { MeshStandardMaterial, type Mesh } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createWorld } from '../game/world'
import type { SurfaceMaterials } from './levelMesh'
import { createStructureLayer } from './structureLayer'

/** Staircase signs are painted on a canvas; a context that ignores every call is enough here. */
const quietContext = new Proxy({}, { get: () => () => ({ addColorStop() {} }), set: () => true })
vi.stubGlobal('document', { createElement: () => ({ getContext: () => quietContext, width: 0, height: 0 }) })

describe('structure layer', () => {
  it('frees the old staircase geometry when the stairwells are rebuilt after a flight is blown away', () => {
    const world = createWorld(1, 'outpost')
    world.stairwells = [{ id: 0, building: 'test', leftX: 10.5, rightX: 15.5, stops: [30, 24, 18], bounds: { x0: 5, x1: 20, streetY: 30, splits: [] } }]
    const layer = createStructureLayer(world, { concrete: new MeshStandardMaterial() } as unknown as SurfaceMaterials)
    const frame = { dt: 1 / 60, view: { x: world.player.x, y: world.player.y }, aim: { x: 0, y: 0 } }
    layer.update(world, frame)
    let freed = 0
    layer.group.traverse((part) => (part as Mesh).geometry?.addEventListener('dispose', () => (freed += 1)))
    world.stairwells = world.stairwells.slice()
    layer.update(world, frame)
    expect(freed).toBeGreaterThan(0)
  })
})
