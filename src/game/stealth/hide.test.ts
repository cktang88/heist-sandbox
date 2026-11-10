import { describe, expect, it } from 'vitest'
import { breakProp } from '../hazards/reactions'
import { addProp } from '../hazards/testWorld'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from '../security/testArena'
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
})
