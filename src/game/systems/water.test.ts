import { describe, expect, it } from 'vitest'
import { explode } from '../explosions'
import { startFire } from '../hazards/fire'
import { isBurningAt, isWetAt } from '../hazards/hazards'
import { addGuard, addProp, bareWorld } from '../hazards/testWorld'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { footingAt } from './footing'
import { liquidAt, liquidField, liquidVolume } from './liquid'
import { stepWading } from './wading'
import { addRoomOf, freshSystems, runAll, shoot } from './testKit'

/**
 * Two storeys: an upper washroom (rows 9..13, floor slab on row 14) with a hole in its floor at columns 30-31,
 * over a lower storey whose floor is the ground slab on row 22.
 */
function twoStoreys(): World {
  const world = freshSystems(bareWorld(60, 24))
  fillTiles(world.grid, 1, 8, 58, 8, 'concrete')
  fillTiles(world.grid, 1, 14, 58, 14, 'concrete')
  fillTiles(world.grid, 30, 14, 31, 14, 'air')
  addRoomOf(world, 'restroom', 2, 9, 36, 5)
  return world
}

describe('water', () => {
  it('a shot ceiling pipe floods the floor, pours through a hole and puts out a fire on the storey below', () => {
    const world = twoStoreys()
    startFire(world, 36, 21, 1, 60)
    addProp(world, 'crate', 36, 22)
    shoot(world, 10.5, 10, 0, -60)
    expect(world.systems.sources).toHaveLength(1)
    runAll(world, 2)
    expect(liquidAt(world, 'water', 10, 13)).toBeGreaterThan(0)
    expect(isWetAt(world, { x: 10.5, y: 13.5 })).toBe(true)
    runAll(world, 25)
    // Through the hole and along the lower floor to the fire.
    expect(liquidAt(world, 'water', 33, 21)).toBeGreaterThan(0)
    expect(isBurningAt(world, { x: 36.5, y: 21.5 })).toBe(false)
  })

  it('a sealed basement fills; a terminal in it shorts out and a guard in it wades', () => {
    const world = twoStoreys()
    // Walls around the lower storey under the hole make a pit nine tiles wide.
    fillTiles(world.grid, 26, 15, 26, 21, 'concrete')
    fillTiles(world.grid, 36, 15, 36, 21, 'concrete')
    world.devices.push({ kind: 'computer', x: 34, y: 20, id: 0, disabled: false, hacked: false })
    const guard = addGuard(world, 28, 22, 1)
    shoot(world, 29.5, 10, 0, -60)
    runAll(world, 40)
    expect(liquidAt(world, 'water', 32, 21)).toBeGreaterThan(1.5)
    expect(world.devices[0].disabled).toBe(true)
    expect(footingAt(world, { x: 28.5, y: 21.5 })).toMatch(/wading|deep/)
    guard.vx = 4
    runAll(world, 0.5)
    expect(Math.abs(guard.vx)).toBeLessThan(1)
  })

  it('a guard in water too deep to stand in is held back as hard as the player would be', () => {
    const world = twoStoreys()
    const field = liquidField(world, 'water')
    for (let x = 20; x <= 30; x += 1) {
      const key = 21 * world.grid.width + x
      field.depth[key] = 2
      field.live[key] = 1
      field.active.push(key)
    }
    const guard = addGuard(world, 25, 22, 1)
    stepWading(world, 1 / 60, 0.1)
    guard.vx = 4
    for (let frame = 0; frame < 10; frame += 1) stepWading(world, 1 / 60, 0)
    expect(guard.vx).toBeCloseTo(4 * Math.exp(-9 * (10 / 60)), 2)
  })

  it('water left in a stair lobby runs down to the lobby below', () => {
    const world = twoStoreys()
    addRoomOf(world, 'stairwell', 40, 9, 8, 5, 'tower', 1)
    addRoomOf(world, 'stairwell', 40, 17, 8, 5, 'tower', 0)
    fillTiles(world.grid, 39, 9, 39, 13, 'concrete')
    world.props.push({ kind: 'sink', x: 44, y: 14, id: world.props.length, hp: 50, broken: true })
    runAll(world, 6)
    expect(liquidAt(world, 'water', 44, 21)).toBeGreaterThan(0)
  })

  it('a running guard slips on a wet floor and goes down', () => {
    const world = twoStoreys()
    for (let x = 5; x < 25; x += 1) world.hazards.wet.set(13 * world.grid.width + x, 60)
    const guard = addGuard(world, 6, 14, 1)
    guard.onGround = true
    let slipped = false
    runAll(world, 15, () => {
      guard.vx = 6
      if (guard.stunSeconds > 0) slipped = true
    })
    expect(slipped).toBe(true)
  })

  it('the player running on a wet floor goes down: stunned for a moment, not just sliding', () => {
    const world = twoStoreys()
    for (let x = 5; x < 25; x += 1) world.hazards.wet.set(13 * world.grid.width + x, 60)
    Object.assign(world.player, { x: 6, y: 14 - world.player.h, onGround: true })
    let stunned = false
    runAll(world, 15, () => {
      world.player.vx = 7
      world.player.onGround = true
      if (world.player.stunSeconds > 0) stunned = true
    })
    expect(stunned).toBe(true)
  })

  it('an explosion bursts the pipes it reaches, and a shot sink pours', () => {
    const world = twoStoreys()
    explode(world, { x: 15, y: 10 }, { radius: 3, tileDamage: 0, bodyDamage: 0 })
    runAll(world, 0.3)
    expect(world.systems.sources.length).toBeGreaterThan(0)
    const other = twoStoreys()
    addProp(other, 'sink', 20, 14)
    shoot(other, 20.4, 13.5, 0, -60)
    runAll(other, 3)
    expect(liquidVolume(other, 'water')).toBeGreaterThan(0.5)
  })
})
