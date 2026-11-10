import { describe, expect, it } from 'vitest'
import type { PropState } from '../cover'
import { addProp } from '../hazards/testWorld'
import { propBox } from '../hazards/props'
import { addGuard, addWall, arena, GROUND, putPlayer, run } from '../security/testArena'
import { boxHitsSolid } from '../physics'
import { fillTiles, setTile } from '../tiles'
import type { World } from '../world'
import { doorBlockedAt, propCover, standingSurfaceUnder } from './physprops'
import { dragSpeed } from './push'
import { shoveSeconds } from './doors'
import { loosen } from './state'

/** Puts the player on the floor with his right side just touching the prop's left edge. */
function besideLeftOf(world: World, prop: PropState, feetY = GROUND): void {
  putPlayer(world, propBox(prop).x - world.player.w / 2 - 0.05, feetY)
  run(world, 0.1)
}

function left(prop: PropState): number {
  return propBox(prop).x
}

describe('dragging furniture', () => {
  it('moves a desk with the player while grab is held, and not otherwise', () => {
    const world = arena()
    const desk = addProp(world, 'desk', 14, GROUND)
    besideLeftOf(world, desk)
    const start = left(desk)
    run(world, 1, { left: true })
    expect(left(desk)).toBe(start)
    besideLeftOf(world, desk)
    run(world, 1, { right: true, grab: true })
    expect(left(desk)).toBeGreaterThan(start + 1)
    expect(left(desk)).toBeLessThan(start + dragSpeed(desk) + 0.5)
  })

  it('pulls as well as pushes', () => {
    const world = arena()
    const desk = addProp(world, 'desk', 14, GROUND)
    besideLeftOf(world, desk)
    const start = left(desk)
    run(world, 1, { left: true, grab: true })
    expect(left(desk)).toBeLessThan(start - 1)
  })

  it('drags heavy things slower than light ones', () => {
    const light = arena()
    const crate = addProp(light, 'crate', 14, GROUND)
    besideLeftOf(light, crate)
    const crateStart = left(crate)
    run(light, 1, { right: true, grab: true })

    const heavy = arena()
    const vending = addProp(heavy, 'vendingMachine', 14, GROUND)
    besideLeftOf(heavy, vending)
    const vendingStart = left(vending)
    run(heavy, 1, { right: true, grab: true })

    expect(left(crate) - crateStart).toBeGreaterThan((left(vending) - vendingStart) * 2)
  })

  it('stops at a wall, and so does the player', () => {
    const world = arena()
    addWall(world, 17)
    const desk = addProp(world, 'desk', 14, GROUND)
    besideLeftOf(world, desk)
    run(world, 3, { right: true, grab: true })
    expect(propBox(desk).x + propBox(desk).w).toBeLessThanOrEqual(17)
    expect(world.player.x + world.player.w).toBeLessThanOrEqual(propBox(desk).x + 0.1)
  })

  it('will not budge built-in or outdoor things', () => {
    const world = arena()
    const counter = addProp(world, 'kitchenCounter', 14, GROUND)
    besideLeftOf(world, counter)
    const start = left(counter)
    run(world, 1, { right: true, grab: true })
    expect(left(counter)).toBe(start)
  })

  it('scrapes loudly enough for a guard nearby to come and look', () => {
    const world = arena()
    const guard = addGuard(world, 20, 1)
    const desk = addProp(world, 'desk', 12, GROUND)
    besideLeftOf(world, desk)
    expect(guard.mode).toBe('calm')
    run(world, 1, { right: true, grab: true })
    expect(guard.mode).not.toBe('calm')
    expect(guard.interest?.kind).toBe('noise')
  })
})

describe('loose furniture and holes', () => {
  /** A pit through the floor at columns 16..19, six rows deep: the floor below is row GROUND + 6. */
  function withPit(world: World): number {
    fillTiles(world.grid, 16, GROUND, 19, GROUND + 5, 'air')
    return GROUND + 6
  }

  it('falls through a hole it is pushed over, comes to rest on the floor below, and hurts whoever is under it', () => {
    const world = arena()
    const below = withPit(world)
    const guard = addGuard(world, 17, 1, 'post', below)
    const desk = addProp(world, 'desk', 14, GROUND)
    besideLeftOf(world, desk)
    run(world, 1.5, { right: true, grab: true })
    run(world, 1.5)
    expect(desk.y).toBe(below)
    expect(guard.hp).toBeLessThan(guard.maxHp)
  })

  const buried = (world: World, prop: PropState) => {
    const box = propBox(prop)
    return boxHitsSolid(world.grid, { x: box.x + 0.02, y: box.y + 0.02, w: box.w - 0.04, h: box.h - 0.04 })
  }

  it('a shoved chair slides to a stop against a wall, not into it', () => {
    const world = arena()
    addWall(world, 20)
    const chair = addProp(world, 'officeChair', 18, GROUND)
    loosen(world, chair).vx = 12
    run(world, 1.5)
    expect(buried(world, chair)).toBe(false)
  })

  it('a plant that tips into a one-tile hole off-centre ends up resting clear of the floor it fell through', () => {
    const world = arena()
    // A shaft one tile wide, two storeys deep.
    fillTiles(world.grid, 16, GROUND, 16, GROUND + 5, 'air')
    const plant = addProp(world, 'plant', 16, GROUND)
    plant.x += 0.15
    loosen(world, plant)
    run(world, 2)
    expect(buried(world, plant)).toBe(false)
  })

  it('crates that drop into a pit narrower than themselves end up resting on its rim, not wedged into it', () => {
    const world = arena()
    // A pit two tiles wide and two deep; the crates are 2.2 wide.
    fillTiles(world.grid, 16, GROUND, 17, GROUND + 1, 'air')
    const crates = addProp(world, 'crateStack', 16, GROUND)
    crates.x += 0.5
    loosen(world, crates)
    run(world, 2)
    expect(buried(world, crates)).toBe(false)
  })

  it('stays put over a gap narrower than half its width', () => {
    const world = arena()
    setTile(world.grid, 14, GROUND, 'air')
    const table = addProp(world, 'cafeteriaTable', 14, GROUND)
    loosen(world, table)
    run(world, 1)
    expect(table.y).toBe(GROUND)
  })
})

describe('standing on furniture', () => {
  it('lands on top of a loose desk and stands there', () => {
    const world = arena()
    const desk = addProp(world, 'desk', 14, GROUND)
    loosen(world, desk)
    putPlayer(world, 13.5)
    run(world, 0.1)
    run(world, 0.05, { jumpPressed: true, jumpHeld: true })
    run(world, 1.5)
    expect(world.player.y + world.player.h).toBeCloseTo(propBox(desk).y, 1)
    expect(standingSurfaceUnder(world, world.player, propBox(desk).y)).toBe(propBox(desk).y)
  })

  it('drops through the top when down is held', () => {
    const world = arena()
    const desk = addProp(world, 'desk', 14, GROUND)
    loosen(world, desk)
    putPlayer(world, 13.5, propBox(desk).y)
    run(world, 0.3)
    expect(world.player.y + world.player.h).toBeCloseTo(propBox(desk).y, 1)
    run(world, 0.5, { down: true })
    expect(world.player.y + world.player.h).toBeCloseTo(GROUND, 1)
  })

  it('makes a desk under a hole in the ceiling a way up to the floor above', () => {
    const climb = (withDesk: boolean): number => {
      const world = arena()
      const ceiling = GROUND - 6
      fillTiles(world.grid, 0, ceiling, 40, ceiling, 'concrete')
      fillTiles(world.grid, 12, ceiling, 13, ceiling, 'air')
      if (withDesk) loosen(world, addProp(world, 'desk', 12, GROUND))
      putPlayer(world, 12.75, withDesk ? GROUND - 1.5 : GROUND)
      run(world, 0.2)
      // Jump straight up into the hole, then lean right onto the edge of the floor above.
      for (let index = 0; index < 120; index += 1) run(world, 1 / 60, { jumpPressed: index === 0, jumpHeld: index < 30, right: index > 14 })
      return world.player.y + world.player.h
    }
    expect(climb(true)).toBeLessThanOrEqual(GROUND - 6 + 0.05)
    expect(climb(false)).toBeGreaterThan(GROUND - 1)
  })
})

describe('blocking doors', () => {
  function doorway(world: World): { x: number; y: number } {
    addWall(world, 20)
    fillTiles(world.grid, 20, GROUND - 3, 20, GROUND - 1, 'door')
    return { x: 20, y: GROUND - 2 }
  }

  it('holds a door shut with heavy loose furniture pushed against it', () => {
    const world = arena()
    const door = doorway(world)
    const vending = addProp(world, 'vendingMachine', 19, GROUND)
    expect(doorBlockedAt(world, door)).toBe(false)
    loosen(world, vending)
    expect(doorBlockedAt(world, door)).toBe(true)
  })

  it('is not held by light furniture', () => {
    const world = arena()
    const door = doorway(world)
    loosen(world, addProp(world, 'crate', 19, GROUND))
    expect(doorBlockedAt(world, door)).toBe(false)
  })

  it('gives way after a guard shoves at it for a few seconds, loudly, and the furniture skids back', () => {
    const world = arena()
    const door = doorway(world)
    const vending = addProp(world, 'vendingMachine', 19, GROUND)
    loosen(world, vending)
    const before = left(vending)
    let blockedFor = 0
    let bangs = 0
    for (let frame = 0; frame < 60 * 10; frame += 1) {
      world.sounds = []
      const blocked = doorBlockedAt(world, door)
      bangs += world.sounds.filter((sound) => sound.kind === 'impact').length
      if (!blocked) break
      blockedFor += 1 / 60
      run(world, 1 / 60)
    }
    expect(blockedFor).toBeGreaterThan(shoveSeconds(vending) - 0.1)
    expect(blockedFor).toBeLessThan(shoveSeconds(vending) + 0.1)
    expect(bangs).toBeGreaterThan(3)
    run(world, 1)
    expect(left(vending)).toBeLessThan(before - 0.5)
  })
})

describe('tipping tables', () => {
  it('kicks a desk over into high cover', () => {
    const world = arena()
    const desk = addProp(world, 'desk', 14, GROUND)
    expect(propCover(world, desk)).toBe('low')
    besideLeftOf(world, desk)
    run(world, 0.1, { kickPressed: true })
    expect(propCover(world, desk)).toBe('high')
    expect(world.physProps.loose.get(desk.id)?.tipped).toBe(1)
  })
})
