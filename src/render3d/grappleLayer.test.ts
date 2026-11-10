import { describe, expect, it } from 'vitest'
import { bareWorld } from '../game/hazards/testWorld'
import { gripOf } from '../game/grapple/line'
import { createGrappleLayer } from './grappleLayer'
import type { SurfaceMaterials } from './levelMesh'

const NO_MATERIALS = {} as SurfaceMaterials
const FRAME = { dt: 1 / 60, view: { x: 20, y: 12 }, aim: { x: 0, y: 0 } }

describe('grapple layer', () => {
  it('draws nothing while the hook is stowed', () => {
    const world = bareWorld()
    const layer = createGrappleLayer(world, NO_MATERIALS)
    layer.update(world, FRAME)
    expect(layer.group.children.filter((child) => child.visible)).toHaveLength(0)
  })

  it('stretches the line from the hook to his hands, bent round a corner when wrapped', () => {
    const world = bareWorld()
    Object.assign(world.grapple, { phase: 'attached', hook: { x: 20, y: 4 }, anchor: { x: 20, y: 3 }, hanging: true, length: 18 })
    const layer = createGrappleLayer(world, NO_MATERIALS)
    layer.update(world, FRAME)
    const [near, far, hook] = layer.group.children
    expect(hook.visible).toBe(true)
    expect(far.visible).toBe(false)
    const hand = gripOf(world.player)
    expect(near.position.x).toBeCloseTo((20 + hand.x) / 2)
    expect(near.scale.y).toBeCloseTo(Math.hypot(20 - hand.x, 4 - hand.y))

    world.grapple.bend = { x: 10, y: 8 }
    layer.update(world, FRAME)
    expect(far.visible).toBe(true)
    expect(far.scale.y).toBeCloseTo(Math.hypot(10, 4))
  })

  it('hangs a parked line straight down to the ground', () => {
    const world = bareWorld()
    Object.assign(world.grapple, { phase: 'parked', hook: { x: 20.5, y: 10 }, anchor: { x: 21, y: 10 }, length: 30 })
    const layer = createGrappleLayer(world, NO_MATERIALS)
    layer.update(world, FRAME)
    const [near] = layer.group.children
    expect(near.position.x).toBeCloseTo(20.5)
    expect(near.scale.y).toBeCloseTo(12)
  })
})
