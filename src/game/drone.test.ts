import { describe, expect, it } from 'vitest'
import { DRONE_PROMPT } from './drone'
import { buildingWorld, run, standAt, STREET } from './grapple/testWorld'
import { boxHitsSolid } from './physics'
import { fillTiles } from './tiles'
import { toolIndex } from './toolDefs'

describe('the drone', () => {
  it('launched crouching under a low ceiling, it lifts off clear of the ceiling and flies', () => {
    const world = buildingWorld()
    fillTiles(world.grid, 5, STREET - 2, 15, STREET - 2, 'concrete')
    standAt(world, 10, STREET)
    run(world, 0.2, { crouch: true })
    world.player.tool = toolIndex('drone')
    run(world, 1 / 60, { crouch: true, fire: true, firePressed: true })
    const drone = world.drone!
    expect(boxHitsSolid(world.grid, drone)).toBe(false)
    const x = drone.x
    run(world, 0.5, { right: true })
    expect(drone.x).toBeGreaterThan(x + 2)
  })

  it('says what E and the trigger do while it is out, and forgets it when it comes back', () => {
    const world = buildingWorld()
    world.player.tool = toolIndex('drone')
    run(world, 1 / 60, { fire: true, firePressed: true })
    run(world, 0.2)
    expect(world.prompt).toBe(DRONE_PROMPT)
    const left = world.player.ammo[toolIndex('drone')]
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(world.drone).toBeNull()
    expect(world.player.ammo[toolIndex('drone')]).toBe(left + 1)
    expect(world.prompt).not.toBe(DRONE_PROMPT)
  })
})
