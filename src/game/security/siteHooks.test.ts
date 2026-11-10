import { describe, expect, it } from 'vitest'
import { circuitOf } from '../complex/kit'
import { createProps, hurtPropsInRadius, sightBlockedByProps } from '../cover'
import { lampPowered } from '../devices/devices'
import { flipPower } from '../devices/power'
import { igniteAt, isBurningAt, throwGrenade } from '../hazards/hazards'
import { startFire } from '../hazards/fire'
import { hurtGuard } from '../guards'
import { fillTiles } from '../tiles'
import type { World } from '../world'
import { radioWorks } from './comms'
import { reportEvent } from './report'
import { feetOf, type Guard } from './model'
import { addDevice, addGuard, addRoom, arena, GROUND, putPlayer, run } from './testArena'

/** An office along the arena floor, lit by one lamp on the room's circuit, with its fuse box by the left wall. */
function litOffice(world: World) {
  const room = addRoom(world, { kind: 'office', building: 'b', x: 10, w: 40, floorY: GROUND })
  const circuit = circuitOf('b', 0)
  world.lamps.push({ x: 30, y: GROUND - 4.5, fixture: 'ceilingPanel', color: 0xffffff, radius: 9, strength: 1.5, hung: false, circuit })
  const box = addDevice(world, { kind: 'fusebox', x: 14, y: GROUND - 2, roomId: room.id, circuit })
  return { room, circuit, lamp: world.lamps[0], box }
}

function bodyInFire(world: World, guard: Guard): boolean {
  const feet = feetOf(guard)
  for (let y = feet.y - 1.5; y < feet.y; y += 0.5) if (isBurningAt(world, { x: feet.x, y })) return true
  return false
}

describe('guards and the lights', () => {
  it('sparks from a wrecked switchgear cabinet black out the room; a guard there puts the lights back on', () => {
    const world = arena()
    const { room, circuit, lamp } = litOffice(world)
    world.props = createProps([{ kind: 'switchgear', x: 44, y: GROUND, roomId: room.id }])
    const guard = addGuard(world, 30, -1)
    hurtPropsInRadius(world, { x: 44.5, y: GROUND - 1.3 }, 2, 1000)
    expect(world.props[0].broken).toBe(true)
    expect(world.deadCircuits.has(circuit)).toBe(true)
    expect(lampPowered(world, lamp)).toBe(false)
    let headedForBox = false
    run(world, 25, {}, () => {
      headedForBox ||= guard.interest?.kind === 'lightsOut'
      return lampPowered(world, lamp)
    })
    expect(headedForBox).toBe(true)
    expect(lampPowered(world, lamp)).toBe(true)
    expect(Math.abs(feetOf(guard).x - 14.5)).toBeLessThan(1.5)
  })

  it('a fuse box cut where nobody sees it shows on the control room panel and someone is sent to it', () => {
    const world = arena()
    const { lamp, box } = litOffice(world)
    const patrol = addGuard(world, 70, -1, 'patrol')
    flipPower(world, box)
    expect(lampPowered(world, lamp)).toBe(false)
    run(world, 25)
    expect(patrol.interest).toBeNull()
    run(world, 60, {}, () => lampPowered(world, lamp))
    expect(world.security.log.some((line) => line.includes('Power fault'))).toBe(true)
    expect(lampPowered(world, lamp)).toBe(true)
  })
})

describe('guards and alarm buttons', () => {
  it('with the radios dead, a guard who finds a body presses a real alarm button and reports where the body is', () => {
    const world = arena()
    addRoom(world, { kind: 'security', building: 'b', x: 2, w: 70, floorY: GROUND })
    addDevice(world, { kind: 'radioRelay', x: 5, y: GROUND - 3, roomId: 0, disabled: true })
    const near = addDevice(world, { kind: 'alarmButton', x: 40, y: GROUND - 2, roomId: 0 })
    addDevice(world, { kind: 'alarmButton', x: 20, y: GROUND - 2, roomId: 0 })
    world.lamps.push({ x: 60, y: GROUND - 4, fixture: 'floodlight', color: 0xffffff, radius: 9, strength: 2, hung: false })
    const victim = addGuard(world, 60, 1)
    const finder = addGuard(world, 50, 1)
    hurtGuard(world, victim, 1000, feetOf(victim))
    // The player gets to the nearer button first.
    near.disabled = true
    let pressedAt = Infinity
    run(world, 40, {}, () => {
      if (world.security.level >= 3) pressedAt = Math.min(pressedAt, world.clock)
      return world.security.level >= 3
    })
    expect(pressedAt).toBeLessThan(40)
    expect(Math.abs(feetOf(finder).x - 20.5)).toBeLessThan(1)
    expect(world.sounds.some((sound) => sound.kind === 'alarm')).toBe(true)
    expect(world.security.lastKnown!.x).toBeGreaterThan(55)
  })
})

describe('radio relays', () => {
  it('radios die in a building only when every one of its relays is out; a building without relays always has radio', () => {
    const world = arena()
    addRoom(world, { kind: 'security', building: 'a', x: 2, w: 30, floorY: GROUND })
    addRoom(world, { kind: 'office', building: 'c', x: 40, w: 30, floorY: GROUND })
    const first = addDevice(world, { kind: 'radioRelay', x: 5, y: GROUND - 3, roomId: 0 })
    const second = addDevice(world, { kind: 'radioRelay', x: 25, y: GROUND - 3, roomId: 0 })
    const inA = { x: 15, y: GROUND }
    const inC = { x: 50, y: GROUND }
    first.disabled = true
    expect(radioWorks(world, inA)).toBe(true)
    second.disabled = true
    expect(radioWorks(world, inA)).toBe(false)
    expect(radioWorks(world, inC)).toBe(true)
  })
})

describe('guards and hazards', () => {
  it('a guard who sees a fire goes to look from a safe distance, radios it in and does not treat it as an intruder', () => {
    const world = arena()
    addRoom(world, { kind: 'office', building: 'b', x: 10, w: 40, floorY: GROUND })
    fillTiles(world.grid, 19, GROUND - 3, 20, GROUND - 1, 'wood')
    for (let y = GROUND - 3; y < GROUND; y += 1) for (const x of [19, 20]) startFire(world, x, y, 1)
    const guard = addGuard(world, 30, -1)
    let stoodInFire = false
    run(world, 15, {}, () => {
      stoodInFire ||= bodyInFire(world, guard)
    })
    expect(world.security.log.some((line) => line.includes('Fire on'))).toBe(true)
    expect(world.security.level).toBe(1)
    expect(world.security.lastKnown).toBeNull()
    expect(guard.mode).not.toBe('combat')
    expect(stoodInFire).toBe(false)
  })

  it('a fire alarm that keeps ringing for the same room (the sprinklers reopening) is one report and one pair sent', () => {
    const world = arena()
    addRoom(world, { kind: 'office', building: 'b', x: 10, w: 40, floorY: GROUND })
    const first = addGuard(world, 60, 1, 'patrol')
    const second = addGuard(world, 90, 1, 'patrol')
    reportEvent(world, { kind: 'fire', at: { x: 30, y: GROUND - 4 }, alarm: true })
    run(world, 10)
    for (const guard of [first, second]) Object.assign(guard, { mode: 'calm', interest: null, follow: null })
    reportEvent(world, { kind: 'fire', at: { x: 30, y: GROUND - 4 }, alarm: true })
    expect(world.security.log.filter((line) => line.includes('Fire alarm')).length).toBe(1)
    expect(second.interest).toBeNull()
  })

  it('a guard caught in flames gets out, is hurt, and does not start a fight with nobody', () => {
    const world = arena()
    const guard = addGuard(world, 30, -1)
    for (let x = 22; x <= 38; x += 1) for (let y = GROUND - 2; y < GROUND; y += 1) startFire(world, x, y, 1, 3)
    let fled = 0
    let fought = false
    let panicked = false
    run(world, 3, {}, () => {
      fled = Math.max(fled, Math.abs(feetOf(guard).x - 30))
      fought ||= guard.mode === 'combat'
      panicked ||= guard.mode === 'panic'
    })
    expect(guard.hp).toBeLessThan(guard.maxHp)
    expect(fought).toBe(false)
    // He walks out because he chose to, not because he broke and ran.
    expect(panicked).toBe(false)
    expect(fled).toBeGreaterThan(7)
  })

  it('a calm guard smothered by a smoke grenade coughs and walks out of the cloud', () => {
    const world = arena()
    const guard = addGuard(world, 30, -1)
    throwGrenade(world, 'smoke', { x: 30.5, y: GROUND - 1 }, { x: 0, y: 1 })
    let coughed = false
    run(world, 6, {}, () => {
      coughed ||= world.security.barks.some((line) => /cough|smoke/i.test(line.text))
    })
    expect(coughed).toBe(true)
    expect(Math.abs(feetOf(guard).x - 30)).toBeGreaterThan(3)
  })

  it('a prop on fire gives no cover', () => {
    const world = arena()
    putPlayer(world, 20.4)
    world.player.crouching = true
    world.props = createProps([{ kind: 'crate', x: 21, y: GROUND }])
    const eye = { x: 30, y: GROUND - 1.25 }
    const body = { x: 20.4, y: GROUND - 0.5 }
    expect(sightBlockedByProps(world, eye, body)).toBe(true)
    igniteAt(world, { x: 21.5, y: GROUND - 0.5 }, 0.9)
    expect(world.hazards.burningProps.has(0)).toBe(true)
    expect(sightBlockedByProps(world, eye, body)).toBe(false)
  })

  it('an explosion breaks an explosive barrel once: one blast, one reaction', () => {
    const world = arena()
    world.props = createProps([{ kind: 'explosiveBarrel', x: 40, y: GROUND }])
    hurtPropsInRadius(world, { x: 39, y: GROUND - 1 }, 3, 200)
    igniteAt(world, { x: 39, y: GROUND - 1 }, 1)
    hurtPropsInRadius(world, { x: 39, y: GROUND - 1 }, 3, 200)
    expect(world.hazards.blasts).toHaveLength(1)
    let explosions = 0
    run(world, 1, {}, () => {
      explosions += world.sounds.filter((sound) => sound.kind === 'explosion').length
      world.sounds.length = 0
    })
    expect(explosions).toBe(1)
  })
})
