import { describe, expect, it } from 'vitest'
import { stepCollapse } from '../collapse'
import { explode } from '../explosions'
import { stepHazards } from '../hazards/hazards'
import { addGuard, addProp, bareWorld } from '../hazards/testWorld'
import { propBox } from '../hazards/props'
import { boxHitsSolid } from '../physics'
import { fillTiles } from '../tiles'
import { idleInput } from '../input'
import { loosen } from '../physprops/state'
import { stepWorld } from '../step'
import type { World } from '../world'
import { stepFallingProps } from './fallingProps'

const FRAME = 1 / 60
const UPPER = 14
const GROUND = 28

/** A garage deck on row 14, held up by walls at both ends, over a ground floor on row 28. */
function garage(): World {
  const world = bareWorld(60, 30)
  fillTiles(world.grid, 1, UPPER, 58, UPPER, 'concrete')
  return world
}

function run(world: World, seconds: number): void {
  for (let frame = 0; frame < Math.round(seconds / FRAME); frame += 1) {
    world.clock += FRAME
    stepCollapse(world, FRAME)
    stepHazards(world, FRAME)
    stepFallingProps(world, FRAME)
  }
}

describe('falling props', () => {
  it('a car whose deck is blown away drops to the floor below, crushes whoever is under it, burns and explodes', () => {
    const world = garage()
    const car = addProp(world, 'car', 20, UPPER)
    const guard = addGuard(world, 20, GROUND, 1)
    run(world, FRAME)
    fillTiles(world.grid, 16, UPPER, 24, UPPER, 'air')
    run(world, 1.2)
    expect(car.y).toBe(GROUND)
    expect(guard.hp).toBeLessThanOrEqual(0)
    expect(world.hazards.burningProps.has(car.id) || car.broken).toBe(true)
    expect(world.sounds.some((sound) => sound.kind === 'explosion')).toBe(false)
    run(world, 5)
    expect(car.broken).toBe(true)
    expect(world.sounds.some((sound) => sound.kind === 'explosion')).toBe(true)
  })

  it('drops when an explosion and the collapse after it take the floor away', () => {
    const world = garage()
    const van = addProp(world, 'van', 30, UPPER)
    run(world, FRAME)
    // Cut the deck at both ends: the whole span between falls, and the van with it.
    fillTiles(world.grid, 10, UPPER, 10, UPPER, 'air')
    fillTiles(world.grid, 50, UPPER, 50, UPPER, 'air')
    world.structureChanged = true
    run(world, 2)
    expect(van.y).toBeGreaterThan(GROUND - 2)
  })

  it('a weak prop breaks when it lands; a sturdy one only dents', () => {
    const world = garage()
    const chair = addProp(world, 'officeChair', 30, UPPER)
    const safe = addProp(world, 'safeSmall', 34, UPPER)
    const turnstile = addProp(world, 'turnstile', 38, UPPER)
    run(world, FRAME)
    fillTiles(world.grid, 28, UPPER, 40, UPPER, 'air')
    run(world, 1.5)
    expect(chair.broken).toBe(true)
    expect([safe.y, turnstile.y]).toEqual([GROUND, GROUND])
    expect(safe.broken).toBe(false)
    expect(turnstile.broken).toBe(false)
    expect(turnstile.hp).toBeLessThan(150)
  })

  it('stays put while most of its floor is still there, and ignores wall props', () => {
    const world = garage()
    const car = addProp(world, 'car', 20, UPPER)
    const poster = addProp(world, 'whiteboard', 30, UPPER + 1)
    run(world, FRAME)
    fillTiles(world.grid, 18, UPPER, 18, UPPER, 'air')
    fillTiles(world.grid, 29, UPPER + 1, 31, UPPER + 1, 'air')
    run(world, 0.5)
    expect(car.y).toBe(UPPER)
    expect(poster.y).toBe(UPPER + 1)
  })

  it('a falling prop comes to rest on rubble or a ledge under part of it instead of sinking into it', () => {
    const world = garage()
    const crates = addProp(world, 'crateStack', 30, UPPER)
    // A lump of rubble on the ground floor under one edge of the crates.
    fillTiles(world.grid, 29, GROUND - 1, 29, GROUND - 1, 'concrete')
    run(world, FRAME)
    fillTiles(world.grid, 26, UPPER, 34, UPPER, 'air')
    run(world, 2)
    const box = propBox(crates)
    expect(boxHitsSolid(world.grid, { x: box.x + 0.05, y: box.y + 0.05, w: box.w - 0.1, h: box.h - 0.1 })).toBe(false)
    expect(crates.y).toBe(GROUND - 1)
  })

  it('a prop dropping through a hole narrower than itself lands clear of the slab it fell through', () => {
    const world = garage()
    const crate = addProp(world, 'crate', 20, UPPER)
    // A wall below holds up the right end of the hole, one row down.
    fillTiles(world.grid, 21, UPPER + 1, 21, GROUND - 1, 'brick')
    run(world, FRAME)
    fillTiles(world.grid, 20, UPPER, 21, UPPER, 'air')
    run(world, 2)
    const box = propBox(crate)
    expect(crate.y).toBeGreaterThan(UPPER)
    expect(boxHitsSolid(world.grid, { x: box.x + 0.05, y: box.y + 0.05, w: box.w - 0.1, h: box.h - 0.1 })).toBe(false)
  })

  it('furniture the player has dragged falls with the furniture physics when its floor goes, and lands once', () => {
    const world = garage()
    const desk = addProp(world, 'desk', 30, UPPER)
    stepWorld(world, idleInput(), FRAME)
    // Some unrelated damage first, so the index of what stands where already exists.
    fillTiles(world.grid, 5, UPPER, 5, UPPER, 'air')
    stepWorld(world, idleInput(), FRAME)
    loosen(world, desk)
    fillTiles(world.grid, 28, UPPER, 32, UPPER, 'air')
    for (let frame = 0; frame < 90; frame += 1) stepWorld(world, idleInput(), FRAME)
    expect(desk.y).toBe(GROUND)
  })

  it('a blast through the deck sends a parked car down', () => {
    const world = garage()
    const car = addProp(world, 'car', 20, UPPER)
    run(world, FRAME)
    explode(world, { x: 20.5, y: UPPER + 1.5 }, { radius: 4, tileDamage: 400, bodyDamage: 10 })
    run(world, 2)
    expect(car.y).toBeGreaterThan(UPPER)
  })
})
