import { describe, expect, it } from 'vitest'
import { startFire } from './hazards/fire'
import { lightLevelAt } from './light'
import { addWall, arena, GROUND } from './security/testArena'
import { VISION } from './security/tuning'

describe('light levels', () => {
  it('a fire lights the dark around it, as it is drawn, but not through a wall', () => {
    const world = arena()
    const beside = { x: 22, y: GROUND - 1 }
    const pastWall = { x: 30, y: GROUND - 1 }
    addWall(world, 27)
    expect(lightLevelAt(world, beside)).toBeLessThan(VISION.dim)
    startFire(world, 24, GROUND - 1, 1)
    expect(lightLevelAt(world, beside)).toBeGreaterThanOrEqual(VISION.lit)
    expect(lightLevelAt(world, pastWall)).toBeLessThan(VISION.dim)
    expect(lightLevelAt(world, { x: 60, y: GROUND - 1 })).toBeLessThan(VISION.dim)
  })

  it('a burning door lights the room in front of it', () => {
    const world = arena()
    addWall(world, 40, 'door')
    startFire(world, 40, GROUND - 2, 1)
    expect(lightLevelAt(world, { x: 38, y: GROUND - 1 })).toBeGreaterThanOrEqual(VISION.lit)
  })
})
