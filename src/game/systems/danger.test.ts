import { describe, expect, it } from 'vitest'
import { startFire } from '../hazards/fire'
import { addGas } from '../hazards/smoke'
import { addProp, bareWorld } from '../hazards/testWorld'
import { fillTiles } from '../tiles'
import { dangerAt, hazardKindAt } from './danger'
import { safeFooting } from './footing'
import { addSource } from './sources'
import { addRoomOf, freshSystems, runAll } from './testKit'

describe('danger for the guards to steer by', () => {
  it('names the worst hazard at a spot and how bad it is', () => {
    const world = freshSystems(bareWorld(60, 24))
    fillTiles(world.grid, 1, 16, 58, 16, 'concrete')
    addRoomOf(world, 'electrical', 2, 17, 50, 5)
    addProp(world, 'transformer', 6, 22, 0)
    addSource(world, 'water', { x: 8, y: 21 }, 1, 3, 'test')
    addSource(world, 'water', { x: 40, y: 21 }, 1, 3, 'test2')
    startFire(world, 25, 21, 1, 60)
    for (let x = 30; x <= 33; x += 1) addGas(world, x, 21, 1)
    runAll(world, 0.5)
    expect(hazardKindAt(world, { x: 9.5, y: 21.5 })).toBe('shock')
    expect(safeFooting(world, { x: 9.5, y: 21.5 })).toBe(false)
    expect(hazardKindAt(world, { x: 25.5, y: 21.5 })).toBe('fire')
    expect(hazardKindAt(world, { x: 31.5, y: 21.5 })).toBe('gas')
    expect(hazardKindAt(world, { x: 40.5, y: 21.5 })).toBe('slippery')
    expect(dangerAt(world, { x: 50.5, y: 21.5 })).toBe(0)
    expect(dangerAt(world, { x: 9.5, y: 21.5 })).toBeGreaterThan(dangerAt(world, { x: 40.5, y: 21.5 }))
  })
})
