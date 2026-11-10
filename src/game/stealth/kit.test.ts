import { describe, expect, it } from 'vitest'
import { addDevice, addGuard, addLamp, addRoom, arena, GROUND, putPlayer, run } from '../security/testArena'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { knockOutCold } from './bodies'
import { createProps } from '../cover'
import { enterSpot } from './hide'
import { DISGUISE, KEYCARD, RADIO } from './tuning'

const holdE = (world: World, seconds: number, extra: object = {}) => {
  run(world, 1 / 60, { interact: true, interactPressed: true, ...extra })
  run(world, seconds, { interact: true, ...extra })
  run(world, 1 / 60, extra)
}

/** A guard out cold at x 20, the player over him. */
function overBody(role: 'post' | 'officer' = 'post'): World {
  const world = arena()
  knockOutCold(world, addGuard(world, 20, 1, role), 1e4)
  run(world, 0.5)
  putPlayer(world, 20)
  run(world, 1 / 60)
  // Tied first: the next E on him is about his kit.
  run(world, 1 / 60, { interact: true, interactPressed: true })
  run(world, 1 / 60)
  return world
}

describe("a downed guard's radio", () => {
  it('rings when control calls him; answering keeps him off the missing list, a couple of times', () => {
    const world = overBody()
    expect(world.prompt).toBe('Hold E: take his radio')
    holdE(world, RADIO.takeSeconds + 0.1)
    expect(world.stealth.radios.has(0)).toBe(true)
    const guard = world.guards[0]
    for (let call = 1; call <= RADIO.bluffs; call += 1) {
      guard.checkInAt = world.clock
      run(world, 2 / 60)
      expect(world.prompt).toContain('answer the radio')
      run(world, 1 / 60, { interact: true, interactPressed: true })
      expect(guard.missing).toBe(false)
    }
    expect(world.security.level).toBe(0)
    guard.checkInAt = world.clock
    run(world, 2 / 60)
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(world.security.level).toBe(1)
  })

  it('can be answered from inside a hiding place, and E gets the player out after', () => {
    const world = overBody()
    holdE(world, RADIO.takeSeconds + 0.1)
    world.props = createProps([{ kind: 'wardrobe', x: 21.5, y: GROUND }])
    enterSpot(world, world.props[0])
    const guard = world.guards[0]
    guard.checkInAt = world.clock
    run(world, 2 / 60)
    expect(world.prompt).toContain('answer the radio')
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(guard.missing).toBe(false)
    expect(world.player.hidden).toBe(true)
  })

  it('an unanswered call marks him missing as usual', () => {
    const world = overBody()
    holdE(world, RADIO.takeSeconds + 0.1)
    world.guards[0].checkInAt = world.clock
    run(world, RADIO.answerSeconds + 0.5)
    expect(world.guards[0].missing).toBe(true)
    expect(world.security.polls.length + (world.security.level > 0 ? 1 : 0)).toBeGreaterThan(0)
  })
})

describe('the disguise', () => {
  function disguised(): World {
    const world = overBody()
    holdE(world, RADIO.takeSeconds + 0.1)
    holdE(world, DISGUISE.takeSeconds + 0.1)
    expect(world.stealth.disguise).not.toBeNull()
    return world
  }

  it('walking past a guard at a distance in full light, the player passes as one of them', () => {
    const world = disguised()
    addLamp(world, 30)
    const guard = addGuard(world, 36, -1)
    putPlayer(world, 30)
    run(world, 3)
    expect(guard.awareness).toBe(0)
  })

  it('up close, or running, or seen by an officer, it does not hold', () => {
    const close = disguised()
    addLamp(close, 30)
    const near = addGuard(close, 32, -1)
    putPlayer(close, 30.4)
    run(close, 3)
    expect(near.awareness).toBeGreaterThan(0)

    const officer = disguised()
    addLamp(officer, 30)
    const boss = addGuard(officer, 36, -1, 'officer')
    putPlayer(officer, 30)
    run(officer, 3)
    expect(boss.awareness).toBeGreaterThan(0)

    const running = disguised()
    addLamp(running, 30)
    addLamp(running, 36)
    const watcher = addGuard(running, 44, -1)
    putPlayer(running, 28)
    run(running, 1.2, { right: true })
    expect(watcher.awareness).toBeGreaterThan(0)
  })

  it('holding a guard as a shield gives him away', () => {
    const world = disguised()
    addLamp(world, 30)
    addGuard(world, 30.6, 1)
    const watcher = addGuard(world, 38, -1)
    putPlayer(world, 30)
    run(world, 2, { grab: true })
    expect(world.melee.shield).not.toBeNull()
    expect(watcher.awareness).toBeGreaterThan(0)
  })

  it('in a restricted room without an officer\'s uniform it gives him away', () => {
    const world = disguised()
    addRoom(world, { kind: 'vault', x: 25, w: 20, floorY: GROUND, building: 'tower' })
    addLamp(world, 30)
    const guard = addGuard(world, 36, -1)
    putPlayer(world, 30)
    run(world, 3)
    expect(guard.awareness).toBeGreaterThan(0)
  })
})

describe('keycards', () => {
  it('lifted from behind an unaware officer, a keycard opens a keypad door at a swipe', () => {
    const world = arena()
    const officer = addGuard(world, 20, 1, 'officer')
    putPlayer(world, 19.1)
    run(world, 0.1, { crouch: true })
    expect(world.prompt).toBe('Hold E: lift his keycard')
    holdE(world, KEYCARD.liftSeconds + 0.1, { crouch: true })
    expect(world.stealth.keycards.has(0)).toBe(true)
    expect(officer.mode).toBe('calm')
    fillTiles(world.grid, 50, GROUND - 3, 50, GROUND - 1, 'door')
    const keypad = addDevice(world, { kind: 'keypad', x: 49, y: GROUND - 2, target: { x: 50, y: GROUND - 1 } })
    putPlayer(world, 49.2)
    run(world, 1 / 60)
    expect(world.prompt).toBe('E: swipe the keycard')
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(keypad.hacked).toBe(true)
  })
})
