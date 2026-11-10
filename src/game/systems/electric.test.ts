import { describe, expect, it } from 'vitest'
import { circuitOf } from '../complex/kit'
import { restoreCircuit } from '../devices/devices'
import { addGas } from '../hazards/smoke'
import { addGuard, addProp, bareWorld } from '../hazards/testWorld'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { footingAt } from './footing'
import { strikeAt } from './lightning'
import { addSource } from './sources'
import { addRoomOf, freshSystems, runAll } from './testKit'

const CIRCUIT = circuitOf('test', 0)

/** One storey: a plant room over columns 2..41, floor slab on row 22, ceiling slab on row 16. */
function plantRoom(): World {
  const world = freshSystems(bareWorld(60, 24))
  fillTiles(world.grid, 1, 16, 58, 16, 'concrete')
  addRoomOf(world, 'electrical', 2, 17, 40, 5)
  return world
}

describe('electricity', () => {
  it('switchgear in a spreading puddle shocks a guard standing in it, then the breaker trips; turning it back on re-arms the water', () => {
    const world = plantRoom()
    addProp(world, 'switchgear', 10, 22, 0)
    const guard = addGuard(world, 16, 22, 1)
    addSource(world, 'water', { x: 13, y: 21 }, 1, 6, 'test')
    let shocked = false
    let trippedAt = -1
    runAll(world, 8, () => {
      if (guard.stunSeconds > 0) shocked = true
      if (trippedAt < 0 && world.deadCircuits.has(CIRCUIT)) trippedAt = world.clock
    })
    expect(shocked).toBe(true)
    expect(guard.hp).toBeLessThan(100)
    expect(trippedAt).toBeGreaterThan(0)
    // Power off: the water is safe.
    expect(footingAt(world, { x: 16.5, y: 21.5 })).not.toBe('live')
    restoreCircuit(world, CIRCUIT)
    runAll(world, 0.5)
    expect(footingAt(world, { x: 16.5, y: 21.5 })).toBe('live')
  })

  it('a server rack soaking in water shorts out, and its sparks light the gas leaking beside it', () => {
    const world = plantRoom()
    const rack = addProp(world, 'serverRack', 20, 22, 0)
    world.deadCircuits.add(CIRCUIT)
    addSource(world, 'water', { x: 20, y: 21 }, 0.6, 4, 'test')
    runAll(world, 0.5)
    world.deadCircuits.delete(CIRCUIT)
    for (let y = 18; y <= 21; y += 1) for (let x = 18; x <= 23; x += 1) addGas(world, x, y, 0.4)
    let flared = false
    runAll(world, 4, () => {
      if (world.hazards.fires.size > 0) flared = true
    })
    expect(rack.broken).toBe(true)
    expect(flared).toBe(true)
  })

  it('blowing out the ceiling above a hung lamp leaves its cable dangling live into the puddle below', () => {
    const world = plantRoom()
    world.lamps.push({ x: 30.5, y: 17.2, fixture: 'pendant', color: 0xffffff, radius: 6, strength: 1, hung: true, circuit: CIRCUIT })
    addSource(world, 'water', { x: 30, y: 21 }, 0.8, 3, 'test')
    runAll(world, 3)
    fillTiles(world.grid, 29, 16, 31, 16, 'air')
    runAll(world, 0.1)
    expect(world.systems.wires).toHaveLength(1)
    Object.assign(world.player, { x: 32.2, y: 22 - world.player.h, vx: 0, vy: 0, hp: 100, onGround: true })
    runAll(world, 0.6)
    expect(world.player.hp).toBeLessThan(100)
  })

  it('lightning striking a puddle shocks whoever is standing in it', () => {
    const world = plantRoom()
    const guard = addGuard(world, 8, 22, 1)
    addSource(world, 'water', { x: 6, y: 21 }, 1, 4, 'test')
    runAll(world, 4)
    strikeAt(world, { x: 5, y: 21 })
    expect(guard.stunSeconds).toBeGreaterThan(0)
  })
})
