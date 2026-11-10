import { describe, expect, it } from 'vitest'
import { fillTiles, tileAt } from '../tiles'
import { fireCells, igniteAt, isBurningAt, nearestFire } from './hazards'
import { addGuard, addProp, bareWorld, run } from './testWorld'

const FLOOR = 15

/** A world with a slab on row FLOOR: wood from x 5 to 20, concrete from 21 on, solid concrete below. */
function woodenFloor(seed = 1) {
  const world = bareWorld(40, 20, seed)
  fillTiles(world.grid, 1, FLOOR, 38, 18, 'concrete')
  fillTiles(world.grid, 5, FLOOR, 20, FLOOR, 'wood')
  return world
}

describe('fire', () => {
  it('spreads across a wooden floor and stops at concrete', () => {
    const world = woodenFloor()
    igniteAt(world, { x: 5.5, y: FLOOR + 0.5 }, 0.8)
    let reachedConcrete = false
    run(world, 60, () => {
      for (const cell of fireCells(world)) if (cell.x > 20) reachedConcrete = true
    })
    let burnt = 0
    for (let x = 5; x <= 20; x += 1) if (tileAt(world.grid, x, FLOOR) === 'air' || world.grid.hp[FLOOR * 40 + x] < 25) burnt += 1
    expect(burnt).toBeGreaterThanOrEqual(14)
    expect(reachedConcrete).toBe(false)
    for (let x = 21; x <= 30; x += 1) expect(world.grid.hp[FLOOR * 40 + x]).toBe(120)
  })

  it('dies without fuel after a short flare', () => {
    const world = woodenFloor()
    igniteAt(world, { x: 30.5, y: FLOOR - 0.5 }, 0.8)
    expect(isBurningAt(world, { x: 30.5, y: FLOOR - 0.5 })).toBe(true)
    run(world, 3)
    expect(world.hazards.fires.size).toBe(0)
    expect(tileAt(world.grid, 30, FLOOR)).toBe('concrete')
  })

  it('climbs a wooden wall faster than it creeps sideways', () => {
    const upward: number[] = []
    const sideways: number[] = []
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const world = bareWorld(40, 20, seed)
      fillTiles(world.grid, 1, FLOOR, 38, 18, 'concrete')
      fillTiles(world.grid, 10, 3, 30, FLOOR - 1, 'wood')
      igniteAt(world, { x: 20.5, y: FLOOR - 0.5 }, 0.8)
      run(world, 8)
      const cells = fireCells(world)
      upward.push(Math.max(...cells.map((cell) => FLOOR - 1 - cell.y)))
      sideways.push(Math.max(...cells.map((cell) => Math.abs(cell.x - 20))))
    }
    const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0)
    expect(total(upward)).toBeGreaterThan(total(sideways))
  })

  it('a burning crate sets the wooden wall beside it alight, then burns away', () => {
    const world = bareWorld(40, 20)
    fillTiles(world.grid, 1, FLOOR, 38, 18, 'concrete')
    fillTiles(world.grid, 12, FLOOR - 3, 12, FLOOR - 1, 'wood')
    const crate = addProp(world, 'crate', 10, FLOOR)
    igniteAt(world, { x: 10.5, y: FLOOR - 0.5 }, 0.9)
    let wallCaught = false
    run(world, 20, () => {
      if (fireCells(world).some((cell) => cell.x === 12)) wallCaught = true
    })
    expect(wallCaught).toBe(true)
    expect(crate.broken).toBe(true)
  })

  it('creeps along the floor from one burning prop to another', () => {
    const world = bareWorld(40, 20)
    fillTiles(world.grid, 1, FLOOR, 38, 18, 'concrete')
    addProp(world, 'crate', 10, FLOOR)
    const neighbour = addProp(world, 'crate', 13, FLOOR)
    igniteAt(world, { x: 10.5, y: FLOOR - 0.5 }, 0.9)
    let caught = false
    run(world, 12, () => {
      if (world.hazards.burningProps.has(neighbour.id)) caught = true
    })
    expect(caught).toBe(true)
  })

  it('hurts people standing in it', () => {
    const world = woodenFloor()
    fillTiles(world.grid, 8, FLOOR - 2, 8, FLOOR - 1, 'wood')
    const guard = addGuard(world, 8, FLOOR, 1)
    igniteAt(world, { x: 8.5, y: FLOOR - 0.5 }, 1 - 1e-9)
    run(world, 3)
    expect(guard.hp).toBeLessThan(100)
  })

  it('tells guards where the nearest fire is', () => {
    const world = woodenFloor()
    expect(nearestFire(world, { x: 0, y: 0 })).toBeNull()
    igniteAt(world, { x: 10.5, y: FLOOR + 0.5 }, 0.8)
    expect(nearestFire(world, { x: 0, y: FLOOR })).toEqual({ x: 10.5, y: FLOOR + 0.5 })
  })

  it('finds the nearest fire within reach among hundreds, and none past it', () => {
    const world = bareWorld(80, 40)
    fillTiles(world.grid, 1, 1, 78, 37, 'wood')
    for (let y = 2; y < 26; y += 1) for (let x = 2; x < 26; x += 1) igniteAt(world, { x: x + 0.5, y: y + 0.5 }, 0.8)
    expect(world.hazards.fires.size).toBeGreaterThan(500)
    expect(nearestFire(world, { x: 29.2, y: 10.5 }, 4)).toEqual({ x: 25.5, y: 10.5 })
    expect(nearestFire(world, { x: 29.2, y: 10.5 }, 3)).toBeNull()
    expect(nearestFire(world, { x: 45, y: 35 })).toEqual({ x: 25.5, y: 25.5 })
  })

  it('replays the same way from the same seed', () => {
    const snapshot = (seed: number) => {
      const world = woodenFloor(seed)
      igniteAt(world, { x: 12.5, y: FLOOR + 0.5 }, 0.8)
      run(world, 15)
      return { fires: fireCells(world).map((cell) => ({ ...cell })), hp: Array.from(world.grid.hp.slice(FLOOR * 40, FLOOR * 40 + 40)) }
    }
    expect(snapshot(7)).toEqual(snapshot(7))
    expect(snapshot(7)).not.toEqual(snapshot(8))
  })
})
