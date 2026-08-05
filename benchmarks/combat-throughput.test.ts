import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING } from '../src/game/config'
import { createSimulation, getSimulationTelemetry, SIMULATION_STEP, spawnStressEnemies, stepSimulation } from '../src/game/combat'
import { GREEN_MARCH } from '../src/game/maps'
import { buildPathInfo } from '../src/game/path'
import { DEFAULT_RUN } from '../src/game/runs'

const benchmarkEnabled = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.RUN_COMBAT_BENCHMARK === '1'

describe.skipIf(!benchmarkEnabled)('combat throughput telemetry', () => {
  for (const enemyCount of [500, 1500]) {
    it(`records ${enemyCount} enemy fixed-tick throughput without a timing gate`, () => {
      const rules = createBaseGameRules(DEFAULT_TUNING)
      const state = createSimulation([], rules, 100, GREEN_MARCH)
      state.spawnTimer = 999
      spawnStressEnemies(state, GREEN_MARCH, rules, enemyCount)
      const context = { map: GREEN_MARCH, pathInfos: GREEN_MARCH.paths.map(buildPathInfo), rules, towers: [], run: DEFAULT_RUN }
      const startedAt = performance.now()
      const ticks = 60
      for (let tick = 0; tick < ticks; tick += 1) stepSimulation(state, context, SIMULATION_STEP)
      const elapsedMs = performance.now() - startedAt
      const telemetry = getSimulationTelemetry(state)
      const result = {
        enemyCount,
        ticks,
        elapsedMs: Number(elapsedMs.toFixed(2)),
        updatesPerSecond: Number((enemyCount * ticks / (elapsedMs / 1000)).toFixed(0)),
        averageStepMs: Number(telemetry.averageStepMs.toFixed(3)),
        spatialQueriesLastTick: telemetry.queries,
        candidatesLastTick: telemetry.candidatesChecked,
      }
      console.info(`[combat-benchmark] ${JSON.stringify(result)}`)
      expect(telemetry.entities).toBe(enemyCount)
      expect(telemetry.simulationSteps).toBe(ticks)
    })
  }
})
