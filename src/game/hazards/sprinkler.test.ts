import { describe, expect, it } from 'vitest'
import { fireCells, igniteAt, sprayViews } from './hazards'
import { addGuard, addProp, addRoom, bareWorld, box, run } from './testWorld'

describe('sprinklers', () => {
  it('open over a fire that keeps burning, ring the fire alarm and put it out', () => {
    const world = bareWorld(40, 20)
    box(world, 5, 10, 20, 14)
    const room = addRoom(world, 5, 10, 16, 5)
    addProp(world, 'sprinkler', 10, 10, room.id)
    const crate = addProp(world, 'crate', 10, 15, room.id)
    const guard = addGuard(world, 34, 18, -1)
    igniteAt(world, { x: 10.5, y: 14.5 }, 0.9)
    run(world, 1.5)
    expect(sprayViews(world).length).toBe(0)
    expect(world.security.level).toBe(0)
    run(world, 1.5)
    expect(sprayViews(world).some((spray) => spray.kind === 'water')).toBe(true)
    // The fire alarm: the site suspects sabotage and sends someone, but nobody has seen an intruder.
    expect(world.security.level).toBe(2)
    expect(world.security.log.some((line) => line.includes('Fire alarm'))).toBe(true)
    expect(world.security.lastKnown).toBeNull()
    expect(world.alarm).toBe(false)
    expect(guard.mode).toBe('investigating')
    expect(guard.interest?.at.x).toBeCloseTo(10.5, 0)
    run(world, 4)
    expect(fireCells(world).length).toBe(0)
    expect(crate.broken).toBe(false)
  })
})
