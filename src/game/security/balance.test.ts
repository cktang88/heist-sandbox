import { describe, expect, it } from 'vitest'
import { lightLevelAt } from '../light'
import { fillTiles } from '../tiles'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { eyeOf, type Guard } from './model'
import { playerLight, zoneOf } from './perception'
import { addGuard, arena, GROUND, putPlayer, run } from './testArena'
import { VISION } from './tuning'

/**
 * Balance checks against the tuning constants (tuning.ts): patience in the dark is rewarded,
 * and carelessness in the light is punished at once.
 */

/** An indoor floor 100 tiles long under a ceiling, lit by office lamps at `lampXs`, dark between their pools. */
function officeFloor(lampXs: number[]): World {
  const world = arena()
  fillTiles(world.grid, 0, GROUND - 6, 110, GROUND - 6, 'concrete')
  world.interiors.push({ kind: 'room', x: 0, y: GROUND - 5, w: 110, h: 5 })
  for (const x of lampXs) world.lamps.push({ x, y: GROUND - 4.8, fixture: 'ceilingPanel', color: 0xffffff, radius: 9, strength: 1, hung: false })
  return world
}

/** A guard on a floor with a patrol walking most of it and a post standing in the dark middle. */
function guardedFloor(): { world: World; guards: Guard[] } {
  const world = officeFloor([30, 70])
  const patrol = addGuard(world, 50, 1, 'patrol')
  patrol.route = [{ x: 22.5, y: GROUND }, { x: 78.5, y: GROUND }]
  const post = addGuard(world, 50, -1)
  putPlayer(world, 4)
  return { world, guards: [patrol, post] }
}

/** Long enough to crawl across a pool of light. */
const CROSSING_SECONDS = 3.5

/**
 * The patient player's rule: crawl on through the dark and through any light he is already in; at the edge of a
 * pool of light, wait until every guard close enough to see into it is walking away, or standing with his back to it
 * and not about to turn.
 */
function safeStep(world: World): boolean {
  const here = centerOf(world.player)
  const ahead: Vec = { x: here.x + 0.8, y: here.y }
  if (lightLevelAt(world, here) >= VISION.dim || lightLevelAt(world, ahead) < VISION.dim) return true
  return world.guards.every((guard) => {
    const eye = eyeOf(guard)
    const away = guard.mode === 'calm' && Math.sign(ahead.x - eye.x) !== guard.facing
    const walkingAway = away && guard.role === 'patrol' && guard.wait <= 0 && Math.abs(guard.vx) > 0.5
    const notTurningYet = away && guard.role !== 'patrol' && guard.wait > CROSSING_SECONDS
    return distance(eye, ahead) > VISION.centralRange + 2 || walkingAway || notTurningYet
  })
}

describe('balance', () => {
  it('a patient player who stays crouched, keeps to the shadows and times the lit stretches crosses a guarded floor unseen', () => {
    const crossing = guardedFloor()
    let worst = 0
    for (let elapsed = 0; elapsed < 300 && crossing.world.player.x < 100; elapsed += 1 / 60) {
      run(crossing.world, 1 / 60, { crouch: true, right: safeStep(crossing.world) })
      worst = Math.max(worst, ...crossing.guards.map((guard) => guard.awareness))
    }
    expect(crossing.world.player.x).toBeGreaterThan(100)
    expect(crossing.world.stats.timesSpotted).toBe(0)
    expect(worst).toBeLessThan(1)
    expect(crossing.world.security.level).toBe(0)
  })

  it('a player sprinting through a lit room past a guard who faces him is noticed within about a second', () => {
    const world = officeFloor([20, 30, 40, 50])
    const guard = addGuard(world, 42, -1)
    putPlayer(world, 18)
    let enteredCone = -1
    let noticedAt = -1
    let spottedAt = -1
    run(world, 5, { right: true }, () => {
      const body = centerOf(world.player)
      if (enteredCone < 0 && zoneOf(guard, eyeOf(guard), body) === 'central' && playerLight(world) >= VISION.lit) enteredCone = world.clock
      if (noticedAt < 0 && guard.mode !== 'calm') noticedAt = world.clock
      if (guard.mode === 'combat') {
        spottedAt = world.clock
        return true
      }
    })
    expect(enteredCone).toBeGreaterThanOrEqual(0)
    expect(noticedAt - enteredCone).toBeLessThan(0.6)
    expect(spottedAt - enteredCone).toBeLessThan(1.25)
  })
})
