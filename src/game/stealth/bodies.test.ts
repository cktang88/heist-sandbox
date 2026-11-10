import { describe, expect, it } from 'vitest'
import type { Guard } from '../guards'
import { addProp } from '../hazards/testWorld'
import { addGuard, addLamp, addWall, arena, GROUND, putPlayer, run } from '../security/testArena'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { knockOutCold } from './bodies'
import { CARRY } from './tuning'

/** A guard out cold at x 20 in the dark arena, the player standing over him. */
function overBody(): { world: World; body: Guard } {
  const world = arena()
  const body = addGuard(world, 20, 1)
  knockOutCold(world, body, 1000)
  run(world, 0.5)
  putPlayer(world, 20)
  run(world, 1 / 60)
  return { world, body }
}

const press = (world: World, key: 'grab' | 'interact' | 'throwPressed') =>
  run(world, 1 / 60, key === 'interact' ? { interact: true, interactPressed: true } : { [key]: true })

describe('carrying bodies', () => {
  it('G picks a body up and drops it again; carrying, the player walks slowly with one hand', () => {
    const { world, body } = overBody()
    world.player.tool = 1
    press(world, 'grab')
    expect(world.stealth.carried).toBe(0)
    run(world, 0.1)
    const startX = world.player.x
    run(world, 1, { right: true })
    expect(world.player.x - startX).toBeLessThan(CARRY.speed + 0.2)
    expect(world.player.tool).toBe(0)
    expect(Math.abs(body.x + body.w / 2 - (world.player.x + world.player.w / 2))).toBeLessThan(1)
    press(world, 'grab')
    expect(world.stealth.carried).toBeNull()
    run(world, 1)
    expect(body.out).toBe(true)
  })

  it('T throws the body off a ledge, and it falls', () => {
    const { world, body } = overBody()
    fillTiles(world.grid, 21, GROUND, 40, GROUND + 6, 'air')
    press(world, 'grab')
    run(world, 0.05, { aim: { x: 40, y: world.player.y } })
    press(world, 'throwPressed')
    run(world, 2)
    expect(body.ragdoll!.points[2].y).toBeGreaterThan(GROUND + 1)
  })

  it('a body in the open is found by a guard who can see it; in the dark behind low cover it is not', () => {
    const world = arena()
    addLamp(world, 20)
    const body = addGuard(world, 20, 1)
    knockOutCold(world, body, 1000)
    const finder = addGuard(world, 27, -1)
    run(world, 2)
    expect(world.stealth.found.has(0)).toBe(true)
    expect(finder.interest?.kind === 'body' || finder.mode === 'searching').toBe(true)

    const dark = arena()
    const hidden = addGuard(dark, 20, 1)
    addProp(dark, 'desk', 22, GROUND)
    knockOutCold(dark, hidden, 1000)
    addGuard(dark, 30, -1)
    run(dark, 2)
    expect(dark.stealth.found.size).toBe(0)
  })

  it('a guard who finds a man out cold wakes him: a lower alert than a corpse', () => {
    const world = arena()
    addLamp(world, 20)
    const body = addGuard(world, 20, 1)
    knockOutCold(world, body, 1000)
    addGuard(world, 26, -1)
    run(world, 15)
    expect(body.out).toBe(false)
    expect(world.security.level).toBe(1)
  })
})

describe('hiding bodies', () => {
  it('E stuffs a carried body into a locker, where a calm patrol walks past it', () => {
    const { world, body } = overBody()
    addProp(world, 'wallLocker', 21, GROUND)
    press(world, 'grab')
    expect(world.prompt).toBe('E: hide the body in the locker')
    press(world, 'interact')
    expect(body.hiddenIn).not.toBeNull()
    expect(world.stealth.carried).toBeNull()
    addLamp(world, 22)
    const patrol = addGuard(world, 26, -1)
    putPlayer(world, 60)
    run(world, 4)
    expect(world.stealth.found.size).toBe(0)
    expect(patrol.mode).toBe('calm')
  })

  it('searchers on a raised alert open the lockers near where they search and find the body', () => {
    const { world, body } = overBody()
    const locker = addProp(world, 'wallLocker', 21, GROUND)
    press(world, 'grab')
    press(world, 'interact')
    putPlayer(world, 80)
    addWall(world, 70)
    world.security.level = 2
    const searcher = addGuard(world, 30, -1)
    searcher.lastKnown = { x: 22, y: GROUND - 1 }
    searcher.mode = 'searching'
    run(world, 12, {}, () => world.stealth.found.size > 0)
    expect(body.hiddenIn).toBeNull()
    expect(world.stealth.found.has(0)).toBe(true)
    expect(world.stealth.opened.has(locker.id)).toBe(true)
  })

  it('a quick kill leaves a blood pool, and a carried corpse a trail of drops; blood leads a guard to look in the hiding places nearby', () => {
    const world = arena()
    const guard = addGuard(world, 20, 1)
    putPlayer(world, 19.1)
    run(world, 0.05)
    press(world, 'interact')
    expect(guard.mode).toBe('dead')
    run(world, 1)
    putPlayer(world, 20)
    run(world, 1 / 60)
    press(world, 'grab')
    addProp(world, 'wardrobe', 30, GROUND)
    run(world, 3, { right: true }, () => world.player.x > 28.5)
    expect(world.stealth.blood.length).toBeGreaterThan(2)
    press(world, 'interact')
    expect(guard.hiddenIn).not.toBeNull()
    putPlayer(world, 100)
    addLamp(world, 22)
    addLamp(world, 28)
    addGuard(world, 14, 1)
    run(world, 30, {}, () => guard.hiddenIn === null)
    expect(guard.hiddenIn).toBeNull()
    expect(world.security.reportedBodies.has(0) || world.stealth.found.has(0)).toBe(true)
  })
})
