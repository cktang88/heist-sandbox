import { describe, expect, it } from 'vitest'
import { fireGrapple } from '../grapple/hook'
import { onLine } from '../grapple/state'
import { throwCharge } from '../charges'
import { distance, centerOf } from '../types'
import { fillTiles } from '../tiles'
import { handOf } from '../tools'
import { normalize } from '../vision'
import type { World } from '../world'
import { enterCombat } from './combat'
import { restrainGuard } from './fear'
import { caseAskedAbout, chargeKeepOff } from './intrusions'
import { feetOf } from './model'
import { addGuard, addLamp, addWall, arena, GROUND, putPlayer, run } from './testArena'

/** The guards against the intruder's newer tricks: the grappling line, cut windows, C4 and questioning. */

/** The player hanging on his grappling line under a concrete bar on row 14, lit, in the open. */
function onTheLine(): World {
  const world = arena()
  fillTiles(world.grid, 20, 14, 40, 14, 'concrete')
  putPlayer(world, 30)
  addLamp(world, 30, GROUND - 4)
  const hand = handOf(world)
  fireGrapple(world, hand, normalize(0.1, 14.5 - hand.y))
  run(world, 0.6)
  run(world, 1.2, { up: true })
  return world
}

describe('the grappling line', () => {
  it('a man hanging on the line has nowhere to hide: every guard with a shot fires, not just the two with tokens and the suppressor', () => {
    const world = onTheLine()
    expect(onLine(world.grapple)).toBe(true)
    const guards = [38, 40, 42, 44, 46].map((x) => addGuard(world, x, -1))
    for (const guard of guards) {
      guard.hp = guard.maxHp = 1e5
      enterCombat(world, guard, centerOf(world.player))
      guard.drawSeconds = 0
    }
    // Distinct guards firing in each second: with tokens alone that is the two holders and the suppressor.
    let best = 0
    let window = new Set<number>()
    let rounds = guards.map((guard) => guard.rounds)
    let windowEnds = world.clock + 1
    run(world, 5, { up: true }, () => {
      guards.forEach((guard, index) => {
        if (guard.rounds < rounds[index]) window.add(index)
      })
      rounds = guards.map((guard) => guard.rounds)
      if (world.clock < windowEnds) return
      best = Math.max(best, window.size)
      window = new Set()
      windowEnds = world.clock + 1
    })
    // One of them may still be on the radio calling it in.
    expect(best).toBeGreaterThanOrEqual(4)
  })

  it('a line left hanging is reported, and the guard goes to the hook and cuts it', () => {
    const world = arena()
    // A roof slab at row 22 with the hook in its edge at x 40, the line hanging down outside.
    fillTiles(world.grid, 40, 22, 70, 22, 'concrete')
    Object.assign(world.grapple, { phase: 'parked', anchor: { x: 40, y: 22 }, hook: { x: 40.5, y: 22.5 }, body: { x: 39.5, y: 29 }, hanging: false })
    putPlayer(world, 120)
    const guard = addGuard(world, 30, 1, 'patrol')
    guard.route = [{ x: 30, y: GROUND }, { x: 36, y: GROUND }]
    run(world, 25, {}, () => world.grapple.phase !== 'parked')
    expect(world.security.lineNoticed).toBe(true)
    expect(world.grapple.phase).not.toBe('parked')
    expect(world.security.level).toBeGreaterThanOrEqual(2)
  })
})

describe('windows', () => {
  it('a pane cut out quietly is noticed only when a guard sees it, like a door left open', () => {
    const world = arena()
    addWall(world, 50)
    fillTiles(world.grid, 50, GROUND - 4, 50, GROUND - 2, 'glass')
    putPlayer(world, 120)
    const guard = addGuard(world, 46, -1, 'post')
    guard.wait = 1e9
    run(world, 0.2)
    fillTiles(world.grid, 50, GROUND - 4, 50, GROUND - 2, 'air')
    run(world, 3)
    expect(world.security.panesNoticed.size).toBe(0)
    guard.facing = 1
    run(world, 2)
    expect(world.security.panesNoticed.size).toBeGreaterThan(0)
    expect(guard.interest?.tamper).toBe('window')
  })
})

describe('C4 in plain view', () => {
  it('a guard who sees a charge stuck to a wall backs out of its blast, warns everyone and never comes close again', () => {
    const world = arena()
    addWall(world, 50)
    putPlayer(world, 46)
    throwCharge(world, { x: 48.8, y: GROUND - 2 }, { x: 1, y: 0 }, { x: 49.9, y: GROUND - 2 })
    run(world, 0.3)
    expect(world.charges[0].stuck).not.toBeNull()
    putPlayer(world, 120)
    const guard = addGuard(world, 42, 1, 'post')
    guard.hp = guard.maxHp = 1e5
    let closestAfter = Infinity
    run(world, 10, {}, () => {
      if (world.security.chargesSeen.size > 0) closestAfter = Math.min(closestAfter, distance(feetOf(guard), centerOf(world.charges[0])))
    })
    expect(world.security.chargesSeen.size).toBe(1)
    expect(distance(feetOf(guard), centerOf(world.charges[0]))).toBeGreaterThan(chargeKeepOff())
    expect(world.security.level).toBeGreaterThanOrEqual(3)
    expect(closestAfter).toBeGreaterThan(chargeKeepOff() - 3)
  })
})

describe('a colleague tied up', () => {
  it('is untied, and says the intruder asked about the case: the alert is confirmed at once', () => {
    const world = arena()
    putPlayer(world, 120)
    const tied = addGuard(world, 40, 1, 'post')
    restrainGuard(world, tied)
    world.intel.questioned.add(tied)
    addLamp(world, 40)
    const rescuer = addGuard(world, 30, 1, 'patrol')
    rescuer.route = [{ x: 30, y: GROUND }, { x: 34, y: GROUND }]
    run(world, 15, {}, () => !tied.restrained)
    expect(tied.restrained).toBe(false)
    expect(caseAskedAbout(world)).toBe(true)
    expect(world.security.level).toBeGreaterThanOrEqual(3)
  })
})

