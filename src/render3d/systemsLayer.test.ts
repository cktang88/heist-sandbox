import { describe, expect, it } from 'vitest'
import type { InstancedBufferGeometry, Mesh } from 'three'
import { bareWorld } from '../game/hazards/testWorld'
import { TILE_KINDS } from '../game/tiles'
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

  it('shows a door left too hot to touch, until it cools or is opened', () => {
    const world = freshSystems(bareWorld(60, 24))
    const layer = createSystemsLayer(world, NO_MATERIALS)
    const frame = { dt: 1 / 60, view: { x: 20, y: 12 }, aim: { x: 0, y: 0 } }
    const [panels] = layer.group.children as Mesh[]
    const key = 12 * world.grid.width + 22
    world.grid.kinds[key] = TILE_KINDS.indexOf('door')
    world.systems.hotDoors.set(key, 20)
    layer.update(world, frame)
    expect(count(panels)).toBe(1)
    world.grid.kinds[key] = TILE_KINDS.indexOf('air')
    layer.update(world, frame)
    expect(panels.visible).toBe(false)
  })

  it('dims water lying in a dark room', () => {
    const world = freshSystems(bareWorld(60, 24))
    const layer = createSystemsLayer(world, NO_MATERIALS)
    const frame = { dt: 1 / 60, view: { x: 20, y: 12 }, aim: { x: 0, y: 0 } }
    const [panels] = layer.group.children as Mesh[]
    addSource(world, 'water', { x: 20, y: 10 }, 1, 5, 'test')
    runAll(world, 1)
    world.lamps.length = 0
    layer.update(world, frame)
    const light = (panels.geometry as InstancedBufferGeometry).getAttribute('aLight').array as Float32Array
    expect(light[0]).toBeLessThan(0.5)
  })
})
