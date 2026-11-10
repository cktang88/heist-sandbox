import { Group, type Mesh, SpotLight } from 'three'
import { describe, expect, it } from 'vitest'
import { knockOutCold } from '../../game/stealth/bodies'
import { createWorld } from '../../game/world'
import { createGuardLights } from './guardLights'

function shining(group: Group): { beams: number; torches: number } {
  const beams = group.children.filter((child) => (child as Mesh).isMesh && child.visible).length
  const torches = group.children.filter((child) => child instanceof SpotLight && child.intensity > 0).length
  return { beams, torches }
}

describe('guard torches', () => {
  it('go out when the guard is knocked out cold or hidden in a locker', () => {
    const world = createWorld(1, 'outpost')
    const [first, ...others] = world.guards
    // Only one guard near the view.
    for (const guard of others) guard.x += 500
    const view = { x: first.x, y: first.y }
    const group = new Group()
    const lights = createGuardLights(group)
    lights.update(world, view)
    expect(shining(group)).toEqual({ beams: 1, torches: 1 })

    knockOutCold(world, first, 60)
    lights.update(world, view)
    expect(shining(group)).toEqual({ beams: 0, torches: 0 })

    first.out = false
    first.hiddenIn = 0
    lights.update(world, view)
    expect(shining(group)).toEqual({ beams: 0, torches: 0 })
  })
})
