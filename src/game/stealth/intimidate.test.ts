import { describe, expect, it } from 'vitest'
import { idleInput } from '../input'
import { addGuard, addLamp, arena, putPlayer, run } from '../security/testArena'
import { centerOf } from '../types'
import { fillTiles } from '../tiles'
import { stealthControls } from './controls'
import { disguiseFactor, fooledCamera } from './disguise'
import { intimidate } from './intimidate'

describe('hands up', () => {
  it('X aimed at a lone guard drops his weapon, raises his hands, and allows tying and interrogation', () => {
    const world = arena()
    putPlayer(world, 30)
    const guard = addGuard(world, 31, -1)
    stealthControls(world, { ...idleInput(centerOf(guard)), whistlePressed: true }, 1 / 60)
    expect(guard.mode).toBe('surrendered')
    expect(guard.droppedWeapon).not.toBeNull()
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(guard.restrained).toBe(true)
    expect(world.prompt).toBe('Hold E: interrogate')
    run(world, 4, { interact: true })
    expect(world.intel.questioned.has(guard)).toBe(true)
  })

  it('a confident guard with backup refuses, while a frightened one submits', () => {
    const world = arena()
    putPlayer(world, 30)
    const guard = addGuard(world, 34, -1)
    addGuard(world, 36, -1)
    addLamp(world, 30)
    expect(intimidate(world, centerOf(guard))).toBe(true)
    expect(guard.mode).toBe('combat')
    guard.nerve = 0.1
    world.clock += 2
    intimidate(world, centerOf(guard))
    expect(guard.mode).toBe('surrendered')
  })

  it('cannot intimidate through a wall, beyond reach, with a drill or with the gun pointed away', () => {
    const world = arena()
    putPlayer(world, 30)
    const guard = addGuard(world, 34, -1)
    expect(intimidate(world, { x: 20, y: guard.y })).toBe(false)
    world.player.tool = 6
    expect(intimidate(world, centerOf(guard))).toBe(false)
    world.player.tool = 0
    putPlayer(world, 20)
    expect(intimidate(world, centerOf(guard))).toBe(false)
    putPlayer(world, 30)
    fillTiles(world.grid, 32, 25, 32, 29, 'concrete')
    expect(intimidate(world, centerOf(guard))).toBe(false)
    expect(guard.mode).toBe('calm')
  })
})

describe('a convincing uniform', () => {
  it('works during site alerts and after a stripped uniform is found; cameras also accept it', () => {
    const world = arena()
    world.player.onGround = true
    world.stealth.disguise = { officer: false }
    world.stealth.uniformKnownAt = world.clock
    world.security.level = 4
    expect(disguiseFactor(world)).toBe(0)
    expect(fooledCamera(world)).toBe(true)
  })

  it('shooting exposes the uniform briefly, then normal behavior restores it', () => {
    const world = arena()
    world.player.onGround = true
    world.stealth.disguise = { officer: false }
    stealthControls(world, { ...idleInput(), firePressed: true }, 1 / 60)
    expect(disguiseFactor(world)).toBe(1)
    expect(fooledCamera(world)).toBe(false)
    world.clock += 4
    expect(disguiseFactor(world)).toBe(0)
  })
})
