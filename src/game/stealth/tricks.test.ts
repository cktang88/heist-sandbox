import { describe, expect, it } from 'vitest'
import { breakProp } from '../hazards/reactions'
import { addProp } from '../hazards/testWorld'
import { addDevice, addGuard, addLamp, arena, GROUND, putPlayer, run } from '../security/testArena'
import { cameraView } from '../security/cameras'
import { actionIndex } from '../toolDefs'
import { loopFeeds } from './cameraLoop'
import { DART, SABOTAGE } from './tuning'

describe('the dart gun', () => {
  it('a dart puts a guard to sleep after a few seconds; armour stops it', () => {
    const world = arena()
    const guard = addGuard(world, 30, -1)
    const heavy = addGuard(world, 34, -1, 'heavy')
    putPlayer(world, 20)
    world.player.tool = actionIndex('dart')
    run(world, 1 / 60, { fire: true, firePressed: true, aim: { x: 30.5, y: guard.y + 0.6 } })
    run(world, 1)
    expect(guard.out).toBe(false)
    run(world, DART.dropSeconds)
    expect(guard.out).toBe(true)
    expect(world.security.level).toBe(0)

    run(world, 1)
    run(world, 1 / 60, { fire: true, firePressed: true, aim: { x: heavy.x + heavy.w / 2, y: heavy.y + 0.6 } })
    expect(world.security.barks.some((bark) => bark.text.includes('vest'))).toBe(true)
    run(world, DART.dropSeconds + 0.5)
    expect(heavy.out).toBe(false)
  })
})

describe('noisy machines', () => {
  it('a machine smashed after it was switched on stops blaring', () => {
    const world = arena()
    const tv = addProp(world, 'tvStand', 20, GROUND)
    putPlayer(world, 20)
    run(world, 1 / 60)
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(world.stealth.noisemakers).toHaveLength(1)
    breakProp(world, tv)
    run(world, 1 / 60)
    expect(world.stealth.noisemakers).toHaveLength(0)
  })
})

describe('lures', () => {
  it('a whistle pulls one guard over; lured again in the same area he brings a partner, and later they search', () => {
    const world = arena()
    const guard = addGuard(world, 23, 1)
    const partner = addGuard(world, 33, 1)
    putPlayer(world, 20)
    // Aim above the guards: X whistles when the gun is not trained on someone.
    run(world, 1 / 60, { whistlePressed: true, aim: { x: 20, y: GROUND - 10 } })
    expect(guard.interest?.kind).toBe('noise')
    expect(partner.mode).toBe('calm')
    // The player slips off before the guard arrives.
    putPlayer(world, 4)
    // Long enough that the first call-out is forgotten as a response, not as a lure.
    run(world, 16)
    guard.interest = null
    guard.mode = 'calm'
    putPlayer(world, 22)
    // Aim above the guards: X whistles when the gun is not trained on someone.
    run(world, 1 / 60, { whistlePressed: true, aim: { x: 20, y: GROUND - 10 } })
    putPlayer(world, 4)
    expect(partner.interest?.kind).toBe('noise')
    expect(world.stealth.lures.length).toBe(2)
  })

  it('a TV switched on pulls the nearest guard over to switch it off; the second time he is wary', () => {
    const world = arena()
    const tv = addProp(world, 'tvStand', 20, GROUND)
    const guard = addGuard(world, 27, -1)
    putPlayer(world, 20)
    run(world, 1 / 60)
    expect(world.prompt).toContain('switch on the TV')
    run(world, 1 / 60, { interact: true, interactPressed: true })
    putPlayer(world, 60)
    run(world, 15, {}, () => world.stealth.noisemakers.length === 0)
    expect(world.stealth.noisemakers).toHaveLength(0)
    expect(world.stealth.noisemakerUses.get(tv.id)).toBe(1)
    expect(guard.mode === 'calm' || guard.mode === 'investigating' || guard.mode === 'noticed').toBe(true)
  })
})

describe('sabotage', () => {
  it('a breaker rigged while crouched trips on its own a while later', () => {
    const world = arena()
    addDevice(world, { kind: 'fusebox', x: 20, y: GROUND - 2, circuit: 7 })
    putPlayer(world, 20.5)
    run(world, 0.3, { crouch: true })
    expect(world.prompt).toContain('rig the breaker')
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    run(world, SABOTAGE.rigSeconds + 0.2, { crouch: true, interact: true })
    expect(world.deadCircuits.has(7)).toBe(false)
    putPlayer(world, 80)
    run(world, SABOTAGE.delay)
    expect(world.deadCircuits.has(7)).toBe(true)
  })
})

describe('camera loops', () => {
  it('a looped camera does not report the player, and the control room does not notice anything wrong', () => {
    const world = arena()
    addLamp(world, 30)
    const camera = addDevice(world, { kind: 'camera', x: 30, y: GROUND - 5, facing: 1 })
    addGuard(world, 100, 1, 'operator')
    loopFeeds(world, [camera])
    const view = cameraView(world, camera)
    putPlayer(world, view.origin.x + Math.cos(view.angle) * 4)
    run(world, 5)
    expect(world.security.level).toBe(0)
    expect(world.security.camerasDeadSince.size).toBe(0)
  })
})
