import { describe, expect, it } from 'vitest'
import { idle } from '../director/testWorld'
import { siteCircuits } from '../director/power'
import { createWorld } from '../world'

/**
 * A blackout over the whole site used to write one "Power fault" line per floor (forty-odd), which pushed everything
 * else out of the eight-line radio log. One building's faults now share one line.
 */
describe('power faults in the radio log', () => {
  it.each([1, 2])('a site-wide blackout writes at most one power-fault line per building (seed %i)', (seed) => {
    const world = createWorld(seed, 'complex')
    for (const circuit of siteCircuits(world)) world.deadCircuits.add(circuit)
    const lines = new Set<string>()
    for (let second = 0; second < 90; second += 1) {
      idle(world, 1)
      for (const line of world.security.log) if (line.includes('Power fault')) lines.add(line.replace(/^\d+:\d+ /, ''))
    }
    const buildings = new Set(world.rooms.map((room) => room.building))
    expect(lines.size).toBeGreaterThan(0)
    // Each building may have its "noted" line and its "check the breaker" line, and may grow its count as reports come in.
    const final = world.security.log.filter((line) => line.includes('Power fault'))
    expect(final.length).toBeLessThanOrEqual(buildings.size * 2)
    // The control room's call to the guards is still there to read, not scrolled away under the faults.
    expect(world.security.log.some((line) => line.includes('stay sharp'))).toBe(true)
  })
})
