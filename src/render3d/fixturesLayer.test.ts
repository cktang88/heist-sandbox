import type { InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'
import { dropFitting } from '../game/systems/hanging'
import { createWorld } from '../game/world'
import { createFixturesLayer } from './fixturesLayer'
import type { SurfaceMaterials } from './levelMesh'

const drawn = (meshes: InstancedMesh[]) => meshes.reduce((sum, mesh) => sum + (mesh.visible ? mesh.count : 0), 0)

describe('fixtures layer', () => {
  it('takes a fitting shot down off the ceiling while it falls', () => {
    const world = createWorld(1, 'outpost')
    const layer = createFixturesLayer(world, {} as SurfaceMaterials)
    const lamp = world.lamps[0]
    const frame = { dt: 1 / 60, view: { x: lamp.x, y: lamp.y }, aim: { x: 0, y: 0 } }
    const bodies = () => (layer.group.children as InstancedMesh[]).filter((mesh) => !mesh.instanceColor)
    layer.update(world, frame)
    const before = drawn(bodies())
    dropFitting(world, { kind: 'lamp', box: { x: lamp.x - 0.4, y: lamp.y - 0.2, w: 0.8, h: 0.4 }, prop: -1, lamp })
    layer.update(world, frame)
    expect(drawn(bodies())).toBeLessThan(before)
  })
})
