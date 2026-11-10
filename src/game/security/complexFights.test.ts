import { describe, expect, it } from 'vitest'
import { fillTiles } from '../tiles'
import { createWorld, type World } from '../world'
import { scriptedFight } from './fightScript'

/**
 * "They just stand there." Scripted fights on the real complex: the player holds a spot and fires short bursts at any
 * guard he can hit, and no guard who knows about the fight may stand about for more than two seconds without moving,
 * firing, sheltering where he can fire from, or deliberately waiting short of a kill zone.
 */

type Scenario = { name: string; spot: { x: number; y: number }; prepare?: (world: World) => void }

const SCENARIOS: Scenario[] = [
  // On the tower's west stair landing at floor 104, firing through the door into the offices.
  { name: 'from a stair landing', spot: { x: 140.5, y: 104 } },
  // Inside the west stairwell, firing through its door into the break room.
  { name: 'through a door', spot: { x: 132.5, y: 104 } },
  // On the roof beside a skylight blown in over the executive suite (floor 32).
  { name: 'from the roof beside a skylight', spot: { x: 173.6, y: 26 }, prepare: (world) => fillTiles(world.grid, 170, 26, 172, 26, 'air') },
  // Hanging on a rope outside the tower's west windows at floor 104.
  { name: 'from a rope outside a window', spot: { x: 84.6, y: 104 } },
]

describe('scripted fights on the complex', () => {
  for (const scenario of SCENARIOS) {
    it(`nobody aware of the fight stands idle: player ${scenario.name}`, () => {
      const world = createWorld(1, 'complex')
      scenario.prepare?.(world)
      world.structureChanged = true
      const report = scriptedFight(world, scenario.spot, 30)
      expect(report.engaged).toBeGreaterThan(0)
      expect(report.idle).toEqual([])
    })
  }

  it('guards return fire in the stairwell and rooftop fights', () => {
    for (const scenario of [SCENARIOS[0], SCENARIOS[2]]) {
      const world = createWorld(1, 'complex')
      scenario.prepare?.(world)
      world.structureChanged = true
      expect(scriptedFight(world, scenario.spot, 30).guardShots).toBeGreaterThan(5)
    }
  })
})
