import { describe, expect, it } from 'vitest'
import { C4_BLAST, explode, withBlastCause } from './explosions'
import { strikeAt } from './systems/systems'
import { addProp } from './hazards/testWorld'
import { addGuard, arena, GROUND, run } from './security/testArena'
import type { World } from './world'

/** A guard on post at x 40 in the dark arena, the player far off at the left where nobody can see him. */
function quietSite(): World {
  const world = arena()
  addGuard(world, 40, -1)
  return world
}

function peakLevel(world: World, seconds: number): number {
  let peak: number = world.security.level
  run(world, seconds, {}, () => {
    peak = Math.max(peak, world.security.level)
  })
  return peak
}

describe('who caused an explosion', () => {
  it("the player's own charge is the intruder's bomb: the site goes to level 3", () => {
    const world = quietSite()
    explode(world, { x: 32, y: GROUND - 1 }, C4_BLAST, 'player')
    expect(peakLevel(world, 10)).toBeGreaterThanOrEqual(3)
  })

  it('an accident nobody saw the player cause is a fire alarm, never an intruder', () => {
    const world = quietSite()
    explode(world, { x: 32, y: GROUND - 1 }, C4_BLAST, 'accident')
    const peak = peakLevel(world, 10)
    expect(peak).toBeGreaterThanOrEqual(1)
    expect(peak).toBeLessThanOrEqual(2)
  })

  it("a guard's own grenade is not reported as the intruder's bomb", () => {
    const world = quietSite()
    explode(world, { x: 32, y: GROUND - 1 }, C4_BLAST, 'guard')
    expect(peakLevel(world, 10)).toBeLessThanOrEqual(2)
  })

  it('a chain the player started counts as his only with evidence of an intruder', () => {
    const unseen = quietSite()
    explode(unseen, { x: 32, y: GROUND - 1 }, C4_BLAST, 'playerChain')
    expect(peakLevel(unseen, 10)).toBeLessThanOrEqual(2)

    const suspected = quietSite()
    suspected.security.level = 2
    explode(suspected, { x: 32, y: GROUND - 1 }, C4_BLAST, 'playerChain')
    expect(peakLevel(suspected, 10)).toBeGreaterThanOrEqual(3)
  })

  it('a barrel set off by a blast carries the cause on as a chain', () => {
    const world = arena()
    addProp(world, 'explosiveBarrel', 20, GROUND)
    addProp(world, 'explosiveBarrel', 60, GROUND)
    explode(world, { x: 19, y: GROUND - 1 }, C4_BLAST, 'player')
    expect(world.hazards.blasts.map((blast) => blast.cause)).toEqual(['playerChain'])
    withBlastCause('accident', () => explode(world, { x: 59, y: GROUND - 1 }, C4_BLAST))
    expect(world.hazards.blasts.map((blast) => blast.cause)).toEqual(['playerChain', 'accident'])
  })

  it('a storm strike that sets off a barrel is an accident', () => {
    const world = quietSite()
    addProp(world, 'explosiveBarrel', 32, GROUND)
    strikeAt(world, { x: 32.5, y: GROUND - 0.5 })
    const peak = peakLevel(world, 15)
    expect(world.props[0].broken).toBe(true)
    expect(peak).toBeLessThanOrEqual(2)
  })
})
