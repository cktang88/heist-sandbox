import { describe, expect, it, vi } from 'vitest'
import { reportEvent } from '../security/dispatch'
import { fireCells, igniteAt, sprayViews } from './hazards'
import { addProp, addRoom, bareWorld, box, run } from './testWorld'

vi.mock('../security/dispatch', async (original) => ({ ...(await original<typeof import('../security/dispatch')>()), reportEvent: vi.fn() }))

describe('sprinklers', () => {
  it('open over a fire that keeps burning, ring the fire alarm and put it out', () => {
    const world = bareWorld(40, 20)
    box(world, 5, 10, 20, 14)
    const room = addRoom(world, 5, 10, 16, 5)
    addProp(world, 'sprinkler', 10, 10, room.id)
    const crate = addProp(world, 'crate', 10, 15, room.id)
    igniteAt(world, { x: 10.5, y: 14.5 }, 0.9)
    run(world, 1.5)
    expect(sprayViews(world).length).toBe(0)
    run(world, 1.5)
    expect(sprayViews(world).some((spray) => spray.kind === 'water')).toBe(true)
    expect(reportEvent).toHaveBeenCalledWith(world, { kind: 'alarmButton', at: expect.objectContaining({ x: 10.5 }) })
    run(world, 4)
    expect(fireCells(world).length).toBe(0)
    expect(crate.broken).toBe(false)
  })
})
