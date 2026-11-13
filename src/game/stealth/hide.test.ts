import { describe, expect, it } from 'vitest'
import { breakProp } from '../hazards/reactions'
import { addProp, bareWorld } from '../hazards/testWorld'
import { FRAME, run as runGrapple, shootAt, standAt } from '../grapple/testWorld'
import { fillTiles } from '../tiles'
import { actionIndex } from '../toolDefs'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from '../security/testArena'
import { searchSpotsNear } from './search'
import type { World } from '../world'

const pressE = (world: World, extra: object = {}) => run(world, 1 / 60, { interact: true, interactPressed: true, ...extra })

describe('hiding the player', () => {
  it.each([
    ['wallLocker', 'E: hide in locker'],
    ['wardrobe', 'E: hide in wardrobe'],
    ['toiletStall', 'E: hide in stall'],
    ['desk', 'E: crawl under desk'],
  ] as const)('a %s offers "%s"; inside, the player is hidden and cannot be seen, even in full light', (kind, prompt) => {
    const world = arena()
    addProp(world, kind, 20, GROUND)
    addLamp(world, 20)
    putPlayer(world, 20)
    run(world, 1 / 60)
    expect(world.prompt).toBe(prompt)
    pressE(world)
    expect(world.player.hidden).toBe(true)
    expect(world.prompt).toBe('E: get out')
    const guard = addGuard(world, 26, -1)
    run(world, 3)
    expect(guard.awareness).toBe(0)
    pressE(world)
    expect(world.player.hidden).toBe(false)
  })

  it('cannot shoot or walk while hidden', () => {
    const world = arena()
    addProp(world, 'wallLocker', 20, GROUND)
    putPlayer(world, 20)
    run(world, 1 / 60)
    pressE(world)
    const x = world.player.x
    run(world, 0.5, { right: true, fire: true, firePressed: true })
    expect(world.player.x).toBe(x)
    expect(world.projectiles).toHaveLength(0)
  })

  it('a guard who saw the player climb in walks over and opens it', () => {
    const world = arena()
    addProp(world, 'wallLocker', 20, GROUND)
    addLamp(world, 20)
    const guard = addGuard(world, 27, -1)
    putPlayer(world, 20)
    run(world, 1 / 60)
    pressE(world)
    expect(world.stealth.watched.size).toBe(1)
    run(world, 8, {}, () => !world.player.hidden)
    expect(world.player.hidden).toBe(false)
    expect(guard.startle !== null || guard.mode === 'combat').toBe(true)
  })

  it('E bursts out onto a guard walking past the locker and chokes him quietly', () => {
    const world = arena()
    addProp(world, 'wallLocker', 20, GROUND)
    putPlayer(world, 20)
    run(world, 1 / 60)
    pressE(world)
    const guard = addGuard(world, 20.6, 1)
    run(world, 1 / 60)
    expect(world.prompt).toBe('E: grab him from hiding')
    pressE(world)
    expect(world.stealth.choke?.struggle).toBe(false)
    run(world, 3, { interact: true })
    expect(guard.out).toBe(true)
    expect(world.security.level).toBe(0)
  })

  it('a fridge or a car boot takes a body but not the player', () => {
    const world = arena()
    addProp(world, 'fridge', 20, GROUND)
    putPlayer(world, 20)
    run(world, 1 / 60)
    expect(world.prompt ?? '').not.toContain('hide in')
  })

  it('a hiding place blown apart puts the player back in the open', () => {
    const world = arena()
    const locker = addProp(world, 'wallLocker', 20, GROUND)
    putPlayer(world, 20)
    run(world, 1 / 60)
    pressE(world)
    breakProp(world, locker)
    run(world, 2 / 60)
    expect(world.player.hidden).toBe(false)
    expect(world.stealth.hiding).toBeNull()
    expect(world.prompt ?? '').not.toBe('E: get out')
  })

  it('is not offered halfway up a climb: E on the way past a locker does not hide him with the climb still going', () => {
    // Two storeys with a hole in the floor between them and a locker on the upper floor beside it.
    const world = bareWorld(60, 40, 1)
    fillTiles(world.grid, 0, 0, 59, 39, 'concrete')
    fillTiles(world.grid, 5, 25, 50, 29, 'air')
    fillTiles(world.grid, 5, 19, 50, 23, 'air')
    fillTiles(world.grid, 20, 24, 22, 24, 'air')
    addProp(world, 'wallLocker', 24, 24)
    world.player.tool = actionIndex('grapple')
    standAt(world, 21.5, 30)
    runGrapple(world, 0.2)
    runGrapple(world, FRAME, { interact: true, interactPressed: true })
    expect(world.player.mantle).not.toBeNull()
    for (let frame = 0; frame < 40 && world.player.mantle; frame += 1) {
      runGrapple(world, FRAME, { interact: true, interactPressed: true })
      expect(world.player.hidden && world.player.mantle !== null).toBe(false)
    }
  })

  it('lets go of a slack grapple line on climbing in, so reeling in does not haul him out', () => {
    const world = bareWorld(60, 40, 1)
    fillTiles(world.grid, 0, 0, 59, 39, 'concrete')
    fillTiles(world.grid, 5, 19, 50, 29, 'air')
    world.player.tool = actionIndex('grapple')
    addProp(world, 'wallLocker', 24, 30)
    standAt(world, 23.5, 30)
    runGrapple(world, 0.2)
    shootAt(world, { x: 26, y: 18.5 })
    expect(world.grapple.phase).toBe('attached')
    runGrapple(world, FRAME, { interact: true, interactPressed: true })
    expect(world.player.hidden).toBe(true)
    const feet = world.player.y + world.player.h
    runGrapple(world, 0.5, { up: true })
    expect(world.player.hidden).toBe(true)
    expect(world.player.y + world.player.h).toBeCloseTo(feet, 1)
    expect(world.grapple.hanging).toBe(false)
  })

  it('a searcher at a stop does not open a locker in the next room through the wall', () => {
    const world = arena()
    addProp(world, 'wallLocker', 46, GROUND)
    putPlayer(world, 46)
    run(world, 1 / 60)
    pressE(world)
    expect(world.player.hidden).toBe(true)
    // A solid wall between his stop and the locker, a few tiles off.
    fillTiles(world.grid, 43, GROUND - 6, 43, GROUND - 1, 'brick')
    world.security.level = 2
    const guard = addGuard(world, 41, 1, 'patrol')
    searchSpotsNear(world, guard, { x: 41.5, y: GROUND })
    expect(world.player.hidden).toBe(true)
    expect(world.stealth.opened.size).toBe(0)
  })
})

