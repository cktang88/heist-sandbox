import { describe, expect, it } from 'vitest'
import type { InstancedBufferGeometry, Mesh } from 'three'
import { bareWorld } from '../game/hazards/testWorld'
import { addSource } from '../game/systems/sources'
import { freshSystems, runAll } from '../game/systems/testKit'
import { dropWire } from '../game/systems/wires'
import type { SurfaceMaterials } from './levelMesh'
import { createSystemsLayer } from './systemsLayer'

const NO_MATERIALS = {} as SurfaceMaterials
const count = (mesh: Mesh) => (mesh.geometry as InstancedBufferGeometry).instanceCount

describe('systems layer', () => {
  it('draws nothing on a dry site, then puddles, the stream feeding them and a live cable with its arc', () => {
    const world = freshSystems(bareWorld(60, 24))
    const layer = createSystemsLayer(world, NO_MATERIALS)
    const frame = { dt: 1 / 60, view: { x: 20, y: 12 }, aim: { x: 0, y: 0 } }
    layer.update(world, frame)
    const [panels, arcs] = layer.group.children as Mesh[]
    expect(panels.visible).toBe(false)
    expect(arcs.visible).toBe(false)
    addSource(world, 'water', { x: 20, y: 10 }, 1, 5, 'test')
    dropWire(world, 21.5, 15, undefined)
    runAll(world, 1)
    layer.update(world, frame)
    expect(count(panels)).toBeGreaterThan(3)
    expect(count(arcs)).toBeGreaterThan(0)
  })
})
