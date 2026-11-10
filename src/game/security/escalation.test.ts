import { describe, expect, it } from 'vitest'
import { stepWorld } from '../step'
import { idleInput } from '../input'
import { createWorld } from '../world'
import { cameraView, isLockedDown, reportEvent } from './dispatch'
import { addDevice, arena, GROUND } from './testArena'

describe('site escalation', () => {
  it('at a confirmed sighting, holds the stairs, sends the response team and searchers; loot seen leaving locks it down', () => {
    const world = createWorld(1, 'complex')
    Object.assign(world.player, { x: 5, y: world.groundY - 1.7, hp: 1e6 })
    const well = world.stairwells.find((candidate) => candidate.building === 'tower')!
    const at = { x: well.leftX + 5, y: well.stops[8] - 0.8 }
    const before = world.guards.length
    reportEvent(world, { kind: 'sighting', at, by: 0 })
    expect(world.security.level).toBe(3)
    expect(world.alarm).toBe(true)
    expect(world.guards.length).toBe(before + 3)
    expect(world.guards.filter((guard) => guard.station).length).toBeGreaterThan(2)
    expect(world.guards.filter((guard) => guard.mode === 'searching').length).toBeGreaterThan(3)
    expect(isLockedDown(world)).toBe(false)
    world.player.hasLoot = true
    stepWorld(world, idleInput(), 1 / 60)
    expect(world.security.level).toBe(4)
    expect(isLockedDown(world)).toBe(true)
  })

  it('cameras sweep, and a cut camera shows as inactive', () => {
    const world = arena()
    const camera = addDevice(world, { kind: 'camera', x: 12, y: GROUND - 4, facing: -1 })
    const first = cameraView(world, camera).angle
    world.clock += 2
    const later = cameraView(world, camera)
    expect(later.angle).not.toBeCloseTo(first, 2)
    expect(Math.cos(later.angle)).toBeLessThan(0)
    expect(later.active).toBe(true)
    camera.disabled = true
    expect(cameraView(world, camera).active).toBe(false)
  })
})
