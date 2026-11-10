import { describe, expect, it } from 'vitest'
import { createProps } from '../cover'
import { throwFrag } from '../frag/frag'
import { isShielded } from '../guards'
import { fillTiles } from '../tiles'
import { feetOf } from './model'
import { isDoorway } from './places'
import { clearOfDoorway } from './selfPreservation'
import { addGuard, addLamp, addUpperFloor, addWall, arena, GROUND, playerHand, putPlayer, run, runListening } from './testArena'
import { fireShot } from '../projectiles'
import { GUNS } from '../guns'
import { normalize } from '../vision'

const saidAny = (lines: string[], words: string[]) => lines.some((line) => words.some((word) => line.includes(word)))
const guardShots = (world: ReturnType<typeof arena>) => world.projectiles.filter((shot) => !shot.fromPlayer).length

function standoff(guardXs: number[]) {
  const world = arena()
  putPlayer(world, 20)
  addLamp(world, 20)
  const guards = guardXs.map((x) => addGuard(world, x, -1))
  return { world, guards }
}

describe('self-preservation', () => {
  it('dives away from a frag that lands close, shouting it', () => {
    const world = arena()
    putPlayer(world, 20)
    const guard = addGuard(world, 32, -1)
    throwFrag(world, { x: 30, y: GROUND - 1.5 }, { x: 0.3, y: 0.2 })
    const before = feetOf(guard).x
    let dived = false
    const lines = runListening(world, 0.8, {}, () => {
      dived ||= guard.diveSeconds > 0
    })
    expect(dived).toBe(true)
    expect(feetOf(guard).x).toBeGreaterThan(before + 1.5)
    expect(saidAny(lines, ['Grenade', 'Get down'])).toBe(true)
  })

  it('goes to ground behind cover to reload, and does not fire until the new magazine is in', () => {
    const { world, guards } = standoff([30])
    world.props = createProps([{ kind: 'filingCabinet', x: 26, y: GROUND }])
    const guard = guards[0]
    run(world, 4, {}, () => guardShots(world) > 0)
    guard.rounds = 1
    run(world, 2, {}, () => guard.reloadSeconds > 0)
    expect(guard.reloadSeconds).toBeGreaterThan(0)
    const shots = guardShots(world)
    let firedWhileReloading = false
    const lines = runListening(world, 1.5, {}, () => {
      firedWhileReloading ||= guardShots(world) > shots + 0 && guard.reloadSeconds > 0.2
    })
    expect(firedWhileReloading).toBe(false)
    expect(guard.crouching).toBe(true)
    expect(saidAny(lines, ['Reloading', 'Changing mag', 'reloading'])).toBe(true)
  })

  it('a shaken guard who has lost sight of the player fires blind at where he last was', () => {
    const { world, guards } = standoff([28])
    const guard = guards[0]
    run(world, 4, {}, () => guard.mode === 'combat' && guard.drawSeconds <= 0)
    guard.shock = 0.25
    addWall(world, 24)
    let blindShots = 0
    const lines = runListening(world, 7.5, {}, () => {
      if (guard.blindFiring && !guard.seesPlayer && world.projectiles.some((shot) => !shot.fromPlayer && shot.life > 2.98)) blindShots += 1
    })
    expect(blindShots).toBeGreaterThan(1)
    expect(saidAny(lines, ['Blind firing', 'Spraying', "can't see", 'head down'])).toBe(true)
  })

  it('two guards moving up to cover go one at a time, one covering while the other moves', () => {
    const { world, guards } = standoff([30, 32])
    world.props = createProps([{ kind: 'filingCabinet', x: 24, y: GROUND }, { kind: 'filingCabinet', x: 26, y: GROUND }])
    let bothMoving = false
    let someoneMoved = false
    const lines = runListening(world, 6, {}, () => {
      bothMoving ||= guards.every((guard) => guard.bounding)
      someoneMoved ||= guards.some((guard) => guard.bounding)
    })
    expect(someoneMoved).toBe(true)
    expect(bothMoving).toBe(false)
    expect(saidAny(lines, ['Moving', 'moving', 'Going up', 'Covering', 'covered', 'Go, go'])).toBe(true)
  })

  it('hauls a badly wounded colleague lying in the open back out of the line of fire', () => {
    const { world, guards } = standoff([26, 27, 31])
    const casualty = addGuard(world, 32.5, -1)
    run(world, 2.5, {}, () => guards.every((guard) => guard.mode === 'combat'))
    casualty.hp = 20
    casualty.stunSeconds = 10
    const before = feetOf(casualty).x
    let rescuer = -1
    const lines = runListening(world, 2, {}, () => {
      if (casualty.draggedBy !== null) rescuer = casualty.draggedBy
    })
    expect(rescuer).toBe(2)
    expect(feetOf(casualty).x).toBeGreaterThan(before + 1.5)
    expect(saidAny(lines, ['got you', 'Hang on', 'Pulling you out'])).toBe(true)
  })

  it('never takes up a position in a doorway', () => {
    const world = arena()
    fillTiles(world.grid, 40, GROUND - 6, 40, GROUND - 4, 'brick')
    expect(isDoorway(world, 40, GROUND)).toBe(true)
    expect(clearOfDoorway(world, { x: 40.5, y: GROUND, high: false }, { x: 30, y: GROUND }).x).toBeGreaterThan(41.5)
    expect(clearOfDoorway(world, { x: 36, y: GROUND, high: false }, { x: 30, y: GROUND }).x).toBe(36)
  })

  it('holds fire while the player has a colleague as a human shield in the way', () => {
    const { world, guards } = standoff([30])
    const hostage = addGuard(world, 21.5, -1)
    run(world, 2.5, {}, () => guards[0].mode === 'combat')
    world.melee.shield = hostage
    hostage.stunSeconds = 5
    expect(isShielded(world, guards[0])).toBe(true)
    const shots = guardShots(world)
    const lines = runListening(world, 3, { grab: true })
    expect(guardShots(world)).toBe(shots)
    expect(saidAny(lines, ['Hold fire', 'No clear shot', "you'll hit him"])).toBe(true)
  })
})

describe('flashbanged', () => {
  it('a steady fighter fires wild, a calm guard stumbles about, and a frightened one covers his face', () => {
    const { world, guards } = standoff([28])
    const fighter = guards[0]
    run(world, 3, {}, () => fighter.mode === 'combat' && fighter.drawSeconds <= 0)
    const calm = addGuard(world, 60, 1)
    const frightened = addGuard(world, 70, 1)
    frightened.shock = 0.6
    run(world, 0.3)
    for (const guard of [fighter, calm, frightened]) guard.blindSeconds = 3
    const lines = runListening(world, 0.5)
    expect(fighter.blindReaction).toBe('wild')
    expect(calm.blindReaction).toBe('stumble')
    expect(frightened.blindReaction).toBe('cover')
    expect(frightened.crouching).toBe(true)
    expect(saidAny(lines, ['My face', "I'm blind", "Don't hurt me"])).toBe(true)
  })
})

describe('where a near miss came from', () => {
  it('a round cracking past tells a guard the line it came along, not where the shooter has moved to since', () => {
    const world = arena()
    const upper = addUpperFloor(world, 0, 40)
    putPlayer(world, 20)
    const guard = addGuard(world, 60, 1)
    guard.deafSeconds = 5
    const hand = playerHand(world)
    // A silent round just over his head, then the shooter is up on the floor above before it gets there.
    fireShot(world, hand, normalize(60 - hand.x, guard.y - 0.6 - hand.y), { ...GUNS.rifle!.shot, spread: 0 })
    putPlayer(world, 20, upper)
    run(world, 1, {}, () => guard.lastKnown !== null)
    expect(guard.lastKnown).not.toBeNull()
    expect(Math.abs(guard.lastKnown!.y - hand.y)).toBeLessThan(2)
  })
})
