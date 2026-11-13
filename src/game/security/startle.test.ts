import { describe, expect, it } from 'vitest'
import { hurtGuard } from '../guards'
import { addProp } from '../hazards/testWorld'
import { openSpot } from '../stealth/search'
import { STARTLE, TAKEDOWN } from '../stealth/tuning'
import { centerOf } from '../types'
import type { World } from '../world'
import type { Guard } from './model'
import { startleSeconds } from './startle'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from './testArena'

/** The player hiding in a locker at x 20, and a guard right in front of it who opens it. */
function foundInLocker(tier: Guard['tier'] = 'regular'): { world: World; guard: Guard } {
  const world = arena()
  addLamp(world, 20)
  const locker = addProp(world, 'wallLocker', 20, GROUND)
  putPlayer(world, 20)
  run(world, 1 / 60, { interact: true, interactPressed: true })
  expect(world.player.hidden).toBe(true)
  const guard = addGuard(world, 21.2, -1, 'post', GROUND, tier)
  openSpot(world, guard, locker)
  return { world, guard }
}

describe('the surprise window', () => {
  it('a lone guard who opens the locker the player is in is startled, and a choke inside the window leaves the site calm', () => {
    const { world, guard } = foundInLocker()
    const far = addGuard(world, 70, 1)
    expect(world.player.hidden).toBe(false)
    expect(guard.startle).not.toBeNull()
    run(world, 0.5)
    expect(guard.mode).not.toBe('combat')
    expect(world.prompt).toBe('Hold E: choke him NOW')
    run(world, 1 / 60, { interact: true, interactPressed: true })
    run(world, TAKEDOWN.struggleSeconds + 2, { interact: true }, () => guard.out)
    expect(guard.out).toBe(true)
    expect(world.security.level).toBe(0)
    expect(world.security.lastKnown).toBeNull()
    expect(far.mode).toBe('calm')
    expect(world.stats.timesSpotted).toBe(0)
  })

  it('letting the window run out ends in a fight and the alert goes up as usual', () => {
    const { world, guard } = foundInLocker()
    run(world, STARTLE.seconds.regular + 0.2)
    expect(guard.startle).toBeNull()
    expect(guard.mode).toBe('combat')
    run(world, 6)
    expect(world.security.level).toBeGreaterThanOrEqual(2)
    expect(world.stats.timesSpotted).toBe(1)
  })

  it('there is no window when a second guard sees it too', () => {
    const world = arena()
    addLamp(world, 20)
    const locker = addProp(world, 'wallLocker', 20, GROUND)
    putPlayer(world, 20)
    run(world, 1 / 60, { interact: true, interactPressed: true })
    const opener = addGuard(world, 21.2, -1)
    const second = addGuard(world, 24, -1)
    openSpot(world, opener, locker)
    expect(opener.startle).toBeNull()
    expect(opener.mode).toBe('combat')
    expect(second.mode).toBe('combat')
  })

  it('a veteran gets a shorter window, an officer shorter still, and a man already hunting almost none', () => {
    const veteran = foundInLocker('veteran').guard
    const regular = foundInLocker('regular').guard
    expect(veteran.startle!.total).toBeLessThan(regular.startle!.total)
    expect(foundInLocker('rookie').guard.startle!.total).toBeGreaterThan(regular.startle!.total)
    const world = arena()
    expect(startleSeconds(addGuard(world, 30, 1, 'officer'))).toBeLessThan(veteran.startle!.total)
    const hunter = addGuard(world, 40, 1)
    hunter.mode = 'searching'
    expect(startleSeconds(hunter)).toBeLessThan(0.5)
  })

  it('is not given to a guard who spots the player from across the room', () => {
    const world = arena()
    addLamp(world, 20)
    addLamp(world, 26)
    const guard = addGuard(world, 27, -1)
    putPlayer(world, 20)
    run(world, 4, {}, () => guard.mode === 'combat' || guard.startle !== null)
    expect(guard.startle).toBeNull()
    expect(guard.mode).toBe('combat')
  })

  it('a guard who walks round a corner into the player at arm\'s length in the dark is startled', () => {
    const world = arena()
    const guard = addGuard(world, 22, -1)
    putPlayer(world, 20.6)
    run(world, 10, {}, () => guard.mode === 'combat' || guard.startle !== null)
    expect(guard.startle).not.toBeNull()
    expect(world.security.level).toBe(0)
  })

  it('a startled guard who is shot and survives snaps out of it and fights at once', () => {
    const { world, guard } = foundInLocker('rookie')
    expect(guard.startle).not.toBeNull()
    hurtGuard(world, guard, 5, centerOf(world.player))
    expect(guard.mode).toBe('combat')
    run(world, 0.2)
    // Not frozen for the rest of a rookie's 3.6 second beat with a bullet in him.
    expect(guard.startle).toBeNull()
  })
})
