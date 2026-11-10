import { describe, expect, it } from 'vitest'
import type { Guard } from '../guards'
import { addGuard, addLamp, arena, GROUND, putPlayer, run } from '../security/testArena'
import type { World } from '../world'
import { TAKEDOWN } from './tuning'

/** The player just behind a calm guard who faces away (right), in the dark arena. */
function behind(role: 'post' | 'heavy' = 'post'): { world: World; guard: Guard } {
  const world = arena()
  const guard = addGuard(world, 20, 1, role)
  putPlayer(world, 19.1)
  run(world, 0.05)
  return { world, guard }
}

describe('silent takedowns', () => {
  it('standing behind an unaware guard, E kills him at once and leaves blood', () => {
    const { world, guard } = behind()
    expect(world.prompt).toBe('E: take down')
    expect(world.stealth.hint).toContain('choke')
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(guard.mode).toBe('dead')
    expect(world.stealth.blood.length).toBeGreaterThan(0)
    expect(world.stats.kills).toBe(1)
  })

  it('crouched, holding E chokes him out silently in a couple of seconds; he lies limp and nobody hears', () => {
    const { world, guard } = behind()
    const other = addGuard(world, 30, 1)
    run(world, 0.1, { crouch: true })
    expect(world.prompt).toBe('Hold E: choke out')
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    run(world, TAKEDOWN.chokeSeconds + 0.2, { crouch: true, interact: true })
    expect(guard.out).toBe(true)
    expect(guard.mode).not.toBe('dead')
    expect(guard.ragdoll).not.toBeNull()
    expect(world.stats.knockouts).toBe(1)
    expect(other.mode).toBe('calm')
    expect(world.security.level).toBe(0)
  })

  it('letting go of E mid-choke lets him break free and fight', () => {
    const { world, guard } = behind()
    run(world, 0.1, { crouch: true })
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    run(world, 0.5, { crouch: true, interact: true })
    run(world, 0.1, { crouch: true })
    expect(guard.out).toBe(false)
    expect(guard.mode).toBe('combat')
  })

  it('a choked man wakes after a few minutes and raises the alert himself, unless he is tied up', () => {
    const { world, guard } = behind()
    const tied = addGuard(world, 60, 1)
    run(world, 0.1, { crouch: true })
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    run(world, TAKEDOWN.chokeSeconds + 0.2, { crouch: true, interact: true })
    putPlayer(world, 59.1)
    run(world, 0.1, { crouch: true })
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    run(world, TAKEDOWN.chokeSeconds + 0.2, { crouch: true, interact: true })
    putPlayer(world, 60)
    run(world, 0.1)
    expect(world.prompt).toContain('tie him up')
    run(world, 1 / 60, { interact: true, interactPressed: true })
    expect(tied.restrained).toBe(true)
    putPlayer(world, 120)
    guard.stunSeconds = 1
    tied.stunSeconds = 1
    run(world, 2)
    expect(guard.out).toBe(false)
    expect(guard.mode).toBe('searching')
    expect(tied.out).toBe(true)
    run(world, 4)
    expect(world.security.level).toBeGreaterThanOrEqual(2)
  })

  it('from the front a calm guard can only be wrestled down, and that is loud enough for a colleague nearby to hear', () => {
    const world = arena()
    const guard = addGuard(world, 20, -1)
    const colleague = addGuard(world, 24, 1)
    // In the light: out of the dark a man can be grabbed quietly whichever way he faces.
    addLamp(world, 19)
    putPlayer(world, 19.1)
    run(world, 1 / 60, { crouch: true })
    expect(world.prompt === 'Hold E: wrestle him down (loud)' || world.prompt === 'Hold E: choke him NOW').toBe(true)
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    run(world, TAKEDOWN.struggleSeconds + 2, { crouch: true, interact: true }, () => guard.out)
    expect(guard.out).toBe(true)
    expect(colleague.mode).not.toBe('calm')
  })

  it('an armoured heavy cannot be grabbed from the front, but can be choked from behind (slower)', () => {
    const world = arena()
    const heavy = addGuard(world, 20, -1, 'heavy')
    addLamp(world, 40)
    putPlayer(world, 21.0)
    run(world, 1 / 60, { crouch: true })
    expect(world.prompt).not.toContain('choke')
    putPlayer(world, 19.1)
    heavy.facing = 1
    run(world, 1 / 60, { crouch: true })
    expect(world.prompt).toBe('Hold E: choke out')
    run(world, 1 / 60, { crouch: true, interact: true, interactPressed: true })
    run(world, TAKEDOWN.chokeSeconds + 0.1, { crouch: true, interact: true })
    expect(heavy.out).toBe(false)
    run(world, TAKEDOWN.heavyChokeSeconds - TAKEDOWN.chokeSeconds + 0.2, { crouch: true, interact: true })
    expect(heavy.out).toBe(true)
    expect(GROUND).toBe(30)
  })
})
