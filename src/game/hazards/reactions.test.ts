import { describe, expect, it } from 'vitest'
import { circuitOf } from '../complex/kit'
import { fillTiles, tileAt } from '../tiles'
import { fireCells, igniteAt, propBroke, sprayViews } from './hazards'
import { hasGas } from './smoke'
import { addProp, addRoom, bareWorld, box, run } from './testWorld'

const FLOOR = 15

function yard() {
  const world = bareWorld(50, 20)
  fillTiles(world.grid, 1, FLOOR, 48, 18, 'concrete')
  return world
}

const explosions = (world: ReturnType<typeof yard>) => world.sounds.filter((sound) => sound.kind === 'explosion').length

describe('reactive props', () => {
  it('explosive barrels set each other off in a rippling chain', () => {
    const world = yard()
    const barrels = [10, 13, 16, 19].map((x) => addProp(world, 'explosiveBarrel', x, FLOOR))
    propBroke(world, barrels[0])
    expect(explosions(world)).toBe(0)
    run(world, 0.3)
    expect(explosions(world)).toBeGreaterThanOrEqual(1)
    expect(barrels[3].broken).toBe(false)
    run(world, 1.5)
    expect(barrels.every((barrel) => barrel.broken)).toBe(true)
    expect(explosions(world)).toBe(4)
  })

  it('a barrel left in a fire cooks off', () => {
    const world = yard()
    const barrel = addProp(world, 'explosiveBarrel', 10, FLOOR)
    addProp(world, 'crate', 11, FLOOR)
    igniteAt(world, { x: 11.5, y: FLOOR - 0.5 }, 0.9)
    run(world, 15)
    expect(barrel.broken).toBe(true)
    expect(explosions(world)).toBeGreaterThanOrEqual(1)
  })

  it('a broken stove leaks gas that explodes when it meets a flame', () => {
    const world = bareWorld(40, 20)
    box(world, 5, 10, 16, 14)
    const stove = addProp(world, 'stove', 8, 15)
    propBroke(world, stove)
    expect(sprayViews(world).some((spray) => spray.kind === 'gas')).toBe(true)
    run(world, 6)
    expect(hasGas(world)).toBe(true)
    expect(explosions(world)).toBe(0)
    igniteAt(world, { x: 11.5, y: 14.5 }, 0.5)
    expect(explosions(world)).toBe(1)
    expect(hasGas(world)).toBe(false)
    expect(sprayViews(world).some((spray) => spray.kind === 'gas')).toBe(false)
  })

  it('a gunshot in the gas lights it', () => {
    const world = bareWorld(40, 20)
    box(world, 5, 10, 16, 14)
    propBroke(world, addProp(world, 'fumeHood', 8, 15))
    run(world, 6)
    world.sounds.push({ kind: 'pistol', x: 9, y: 13 })
    run(world, 0.1)
    expect(explosions(world)).toBe(1)
  })

  it('a wrecked transformer sparks and cuts its room lights', () => {
    const world = yard()
    const room = addRoom(world, 5, 10, 20, 5)
    const transformer = addProp(world, 'transformer', 10, FLOOR)
    propBroke(world, transformer)
    expect(world.sounds.some((sound) => sound.kind === 'spark')).toBe(true)
    expect(world.deadCircuits.has(circuitOf(room.building, room.storey))).toBe(true)
  })

  it('a burst extinguisher puts out the fire it is aimed at and blinds people close by', () => {
    const world = yard()
    fillTiles(world.grid, 14, FLOOR - 4, 14, FLOOR - 1, 'wood')
    igniteAt(world, { x: 14.5, y: FLOOR - 1.5 }, 0.9)
    run(world, 3)
    expect(fireCells(world).length).toBeGreaterThan(0)
    Object.assign(world.player, { x: 11.6, y: FLOOR - 1.6 })
    const extinguisher = addProp(world, 'fireExtinguisher', 12, FLOOR - 2)
    propBroke(world, extinguisher)
    expect(world.player.blindSeconds).toBeGreaterThan(1)
    run(world, 3)
    expect(fireCells(world).length).toBe(0)
    expect(tileAt(world.grid, 14, FLOOR - 1)).toBe('wood')
  })

  it('reacts only once however often it is broken', () => {
    const world = yard()
    const barrel = addProp(world, 'explosiveBarrel', 10, FLOOR)
    propBroke(world, barrel)
    propBroke(world, barrel)
    run(world, 1)
    expect(explosions(world)).toBe(1)
  })
})
