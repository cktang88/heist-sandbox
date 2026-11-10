import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import type { Vec } from '../types'
import { createWorld, type World } from '../world'
import { perturb, PERTURBATIONS, scriptedFight } from './fightScript'
import { outsideWindowSpot, roofSpot, stairDoorSpot, stairLandingSpot } from './fightSpots'

/**
 * "They just stand there." Scripted fights on the real complex: the player holds a spot and fires short bursts at any
 * guard he can hit, and no guard who knows about the fight may stand about for more than two seconds without moving,
 * firing, sheltering where he can fire from, or deliberately waiting short of a kill zone.
 * The spots are found from the site (fightSpots.ts), so they keep their meaning when the generator moves rooms.
 */

type Scenario = { name: string; place: (world: World) => Vec }

const SCENARIOS: Scenario[] = [
  // On a middle storey's landing of the tower's west stairs, firing through the stairwell door.
  { name: 'from a stair landing', place: stairLandingSpot },
  // Inside the same stairwell a few steps from its other door, firing through it.
  { name: 'through a door', place: stairDoorSpot },
  // On the roof beside a skylight blown in over the highest executive room.
  {
    name: 'from the roof beside a skylight',
    place: (world) => {
      const { spot, skylight } = roofSpot(world)
      fillTiles(world.grid, skylight.x0, skylight.y, skylight.x1, skylight.y, 'air')
      return spot
    },
  },
  // Hanging on a rope outside a window in the tower's west wall.
  { name: 'from a rope outside a window', place: outsideWindowSpot },
]

/** Each scenario on two seeds (even seeds mirror the site), each after a few different numbers of extra random draws. */
const SEEDS = [1, 2]

function fight(scenario: Scenario, seed: number, draws: number) {
  const world = createWorld(seed, 'complex')
  perturb(world, draws)
  const spot = scenario.place(world)
  world.structureChanged = true
  return scriptedFight(world, spot, 30)
}

const CASES = SCENARIOS.flatMap((scenario) => SEEDS.flatMap((seed) => PERTURBATIONS.map((draws) => ({ scenario, seed, draws }))))

/** Fights in which the guards must also be seen to fire back, checked on the same runs rather than fought again. */
const RETURN_FIRE = new Set([SCENARIOS[0], SCENARIOS[2]])
/** A whole fight on the big site can take a minute on a busy machine. */
const FIGHT_TIMEOUT = 240_000

describe('scripted fights on the complex', () => {
  it.each(CASES)('nobody aware of the fight stands idle: player $scenario.name (seed $seed, $draws extra draws)', ({ scenario, seed, draws }) => {
    const report = fight(scenario, seed, draws)
    expect(report.engaged).toBeGreaterThan(0)
    expect(report.idle).toEqual([])
    // The stairwell and rooftop fights: guards return fire.
    if (seed === 1 && RETURN_FIRE.has(scenario)) expect(report.guardShots).toBeGreaterThan(5)
  }, FIGHT_TIMEOUT)
})
