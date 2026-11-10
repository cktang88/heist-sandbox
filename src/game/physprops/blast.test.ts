import { describe, expect, it } from 'vitest'
import { explode, ROCKET_BLAST } from '../explosions'
import { propCenter } from '../hazards/props'
import { addProp } from '../hazards/testWorld'
import { addGuard, arena, GROUND, run } from '../security/testArena'
import { fillTiles } from '../tiles'
import { MAX_THROWN_PER_BLAST } from './blast'

const AT = { x: 40, y: GROUND - 1 }
/** Hurts props and people but leaves the floor, so a test sees only the throw. */
const SOFT = { radius: 3, tileDamage: 0, bodyDamage: 60 }

describe('blasts throw furniture', () => {
  it('a chair beside a blast is thrown outward and comes to rest further away', () => {
    const world = arena()
    const chair = addProp(world, 'officeChair', 43.5, GROUND)
    const before = propCenter(chair).x
    explode(world, AT, SOFT)
    expect(world.physProps.loose.get(chair.id)?.vx ?? 0).toBeGreaterThan(0)
    run(world, 4)
    const loose = world.physProps.loose.get(chair.id)
    expect(propCenter(chair).x - before).toBeGreaterThan(2)
    expect(loose?.flying).toBe(false)
    expect(loose?.vx).toBe(0)
    expect(chair.y + 0).toBeLessThanOrEqual(GROUND)
  })

  it('heavy furniture only shifts, light things fly further', () => {
    const world = arena()
    const bin = addProp(world, 'bin', 36, GROUND)
    const vending = addProp(world, 'vendingMachine', 43, GROUND)
    const binFrom = propCenter(bin).x
    const vendingFrom = propCenter(vending).x
    explode(world, AT, SOFT)
    run(world, 4)
    const binMoved = binFrom - propCenter(bin).x
    const vendingMoved = propCenter(vending).x - vendingFrom
    expect(vendingMoved).toBeGreaterThan(0)
    expect(vendingMoved).toBeLessThan(1.5)
    expect(binMoved).toBeGreaterThan(vendingMoved * 2)
  })

  it('bolted fixtures stay put', () => {
    const world = arena()
    const toilet = addProp(world, 'toilet', 41.5, GROUND)
    const x = toilet.x
    explode(world, AT, ROCKET_BLAST)
    run(world, 2)
    expect(toilet.x).toBe(x)
    expect(world.physProps.loose.has(toilet.id)).toBe(false)
  })

  it('only a few, nearest first, are thrown by one blast', () => {
    const world = arena()
    const stools = Array.from({ length: 20 }, (_, index) => addProp(world, 'barStool', 43.5 + index * 0.2, GROUND))
    explode(world, AT, SOFT)
    const thrown = stools.filter((stool) => world.physProps.loose.has(stool.id))
    expect(thrown.length).toBe(MAX_THROWN_PER_BLAST)
    const gaps = (list: typeof stools) => list.map((stool) => Math.abs(propCenter(stool).x - AT.x))
    expect(Math.max(...gaps(thrown))).toBeLessThanOrEqual(Math.min(...gaps(stools.filter((stool) => !thrown.includes(stool)))))
  })

  it('a thrown chair hurts a guard it hits', () => {
    const world = arena()
    const chair = addProp(world, 'officeChair', 43.5, GROUND)
    const guard = addGuard(world, 47.5, -1)
    const hp = guard.hp
    explode(world, AT, SOFT)
    expect(guard.hp).toBe(hp)
    run(world, 2)
    expect(guard.hp).toBeLessThan(hp)
    expect(chair.broken).toBe(false)
  })

  it('a thrown thing falls through a hole in the floor', () => {
    const world = arena()
    fillTiles(world.grid, 0, GROUND + 6, world.grid.width - 1, GROUND + 7, 'concrete')
    fillTiles(world.grid, 46, GROUND, 58, GROUND + 5, 'air')
    const bin = addProp(world, 'bin', 43.5, GROUND)
    explode(world, AT, SOFT)
    run(world, 5)
    expect(bin.y).toBeGreaterThan(GROUND + 3)
  })
})
