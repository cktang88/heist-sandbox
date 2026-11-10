import { describe, expect, it } from 'vitest'
import { bareWorld } from '../game/hazards/testWorld'
import type { SurfaceMaterials } from './levelMesh'
import { createSandboxLayer } from './sandboxLayer'

/** The layer uses only its own materials. */
const NO_MATERIALS = {} as SurfaceMaterials

describe('sandbox layer', () => {
  it('shows a frag where it is and a rope down its column, and hides the unused pool', () => {
    const world = bareWorld()
    world.frags.push({ x: 10, y: 20, w: 0.3, h: 0.3, vx: 0, vy: 0, onGround: true, fuse: 2, stairs: null })
    world.ropes.push({ x: 30, top: 5, bottom: 20, anchor: { x: 29, y: 6 } })
    const layer = createSandboxLayer(world, NO_MATERIALS)
    layer.update(world, { dt: 1 / 60, view: { x: 20, y: 12 }, aim: { x: 0, y: 0 } })
    const shown = layer.group.children.filter((child) => child.visible)
    expect(shown).toHaveLength(2)
    expect(shown[0].position.x).toBeCloseTo(10.15)
    expect(shown[0].position.y).toBeCloseTo(-20.15)
    expect(shown[1].position.x).toBeCloseTo(30.5)
    expect(shown[1].position.y).toBeCloseTo(-5)
  })
})
