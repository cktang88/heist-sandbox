import { describe, expect, it } from 'vitest'
import { loopFeeds } from '../game/stealth/cameraLoop'
import { createWorld } from '../game/world'
import { drawnState } from './devicesLayer'

describe('devices layer', () => {
  it('shows a camera whose feed is looped as harmless (like a hacked one) until the loop runs out', () => {
    const world = createWorld(1, 'complex')
    const camera = world.devices.find((device) => device.kind === 'camera')!
    expect(drawnState(world, camera).hacked).toBe(false)
    loopFeeds(world, [camera])
    expect(drawnState(world, camera).hacked).toBe(true)
    world.clock += 1000
    expect(drawnState(world, camera).hacked).toBe(false)
  })
})
