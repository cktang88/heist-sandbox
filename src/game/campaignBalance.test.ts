import { describe, expect, it } from 'vitest'
import { createSimulation, isRunWon, stepSimulation } from './combat'
import { createBaseGameRules, DEFAULT_TUNING } from './config'
import { GREEN_MARCH } from './maps'
import { buildPathInfo } from './path'
import { isValidPlacement } from './placement'
import { DEFAULT_RUN } from './runs'
import { aimRotation } from './towerFacing'
import type { Placement, Point } from './types'

describe('campaign teaching balance', () => {
  it('lets four well-aimed starter Rivet Guns clear Green March', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const towers = [
      rivet(1, { x: -8.2, z: -0.4 }, { x: -7.2, z: -2.3 }),
      rivet(2, { x: -4.2, z: 4.5 }, { x: -2.8, z: 2.7 }),
      rivet(3, { x: 0.7, z: 0.5 }, { x: 1.8, z: 1.6 }),
      rivet(4, { x: 5.2, z: -3.5 }, { x: 5.2, z: -1.5 }),
    ]
    expect(towers.every((tower, index) => isValidPlacement(tower, tower.kind, towers.slice(0, index), GREEN_MARCH))).toBe(true)
    const state = createSimulation(towers, rules, 100, GREEN_MARCH)
    const context = { map: GREEN_MARCH, pathInfos: GREEN_MARCH.paths.map(buildPathInfo), rules, towers, run: DEFAULT_RUN }
    for (let tick = 0; tick < 180 * 30 && state.baseHealth > 0 && !isRunWon(state, DEFAULT_RUN); tick += 1) {
      stepSimulation(state, context, 1 / 30)
    }
    expect(isRunWon(state, DEFAULT_RUN)).toBe(true)
    expect(state.baseHealth).toBeGreaterThan(0)
  })
})

function rivet(id: number, point: Point, target: Point): Placement {
  return { id, kind: 'gunner', ...point, rotation: aimRotation(point, target) }
}
