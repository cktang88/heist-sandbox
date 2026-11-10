import { InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { stepGaps } from '../game/gaps/gaps'
import { idleInput } from '../game/input'
import { GROUND } from '../game/level'
import { setTile } from '../game/tiles'
import { createWorld } from '../game/world'
import { createGapsLayer } from './gapsLayer'
import type { SurfaceMaterials } from './levelMesh'

const NO_MATERIALS = {} as SurfaceMaterials
const FRAME = { dt: 1 / 60, view: { x: 90, y: 30 }, aim: { x: 0, y: 0 } }

describe('gaps layer', () => {
  it('draws nothing until a floor is holed, then a back strip over each walk-past hole tile', () => {
    const world = createWorld(1, 'outpost')
    const layer = createGapsLayer(world, NO_MATERIALS)
    layer.update(world, FRAME)
    expect(layer.group.visible).toBe(false)

    const floorY = GROUND - 6
    setTile(world.grid, 88, floorY, 'air')
    setTile(world.grid, 89, floorY, 'air')
    stepGaps(world, idleInput({ x: 0, y: 0 }))
    layer.update(world, FRAME)
    expect(layer.group.visible).toBe(true)
    const strips = layer.group.children[0] as InstancedMesh
    expect(strips.count).toBe(4)
    const matrix = new Matrix4()
    const at = new Vector3()
    const size = new Vector3()
    strips.getMatrixAt(0, matrix)
    matrix.decompose(at, new Quaternion(), size)
    expect(at.x).toBeGreaterThan(88)
    expect(at.x).toBeLessThan(90)
    expect(at.y).toBeCloseTo(-(floorY + 0.5), 1)
    // From the back wall to a broken edge well behind the walking lane.
    expect(at.z - size.z / 2).toBeCloseTo(-2.4, 2)
    expect(at.z + size.z / 2).toBeLessThan(-0.7)
  })
})
