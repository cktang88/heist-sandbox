import { Matrix4, type InstancedMesh } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { createGrid, isSolidAt, setTile } from '../../game/tiles'
import { createWorld } from '../../game/world'
import { createScorch, plumeSpan } from './scorch'

/** The burn textures are painted pixel by pixel on a canvas; a stand-in that keeps the pixels is enough here. */
const context = { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }
vi.stubGlobal('document', { createElement: () => ({ getContext: () => context, width: 0, height: 0 }) })

describe('scorch plume', () => {
  it('climbs the back wall up to the ceiling and no further', () => {
    const grid = createGrid(20, 20)
    for (let x = 0; x < 20; x += 1) setTile(grid, x, 10, 'concrete')
    // A charge just under the ceiling (row 10 is the slab).
    const span = plumeSpan(grid, 5.5, 11.3, 2.5)
    expect(span.top).toBe(11)
    expect(span.bottom).toBeCloseTo(11.8)
  })

  it('keeps its full height in an open room', () => {
    const grid = createGrid(20, 20)
    const span = plumeSpan(grid, 5.5, 15, 2)
    expect(span.top).toBeCloseTo(12.4)
  })

  it('drops a floor burn once the floor under it is blown away', () => {
    const world = createWorld(1, 'outpost')
    const x = world.player.x + 0.5
    let floorRow = 0
    while (!isSolidAt(world.grid, x, floorRow + 0.5)) floorRow += 1
    const scorch = createScorch()
    scorch.burn(world, x, floorRow - 0.5, 2)
    const [, floor] = scorch.group.children as InstancedMesh[]
    const at = new Matrix4()
    floor.getMatrixAt(0, at)
    expect(at.determinant()).not.toBe(0)
    setTile(world.grid, Math.floor(x), floorRow, 'air')
    world.grid.version += 1
    scorch.refresh(world)
    floor.getMatrixAt(0, at)
    expect(at.determinant()).toBe(0)
  })
})
