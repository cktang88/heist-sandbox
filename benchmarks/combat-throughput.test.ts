import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING } from '../src/game/config'
import { createSimulation, getSimulationTelemetry, SIMULATION_STEP, spawnStressEnemies, stepSimulation } from '../src/game/combat'
import { GREEN_MARCH } from '../src/game/maps'
import { buildPathInfo } from '../src/game/path'
import { DEFAULT_RUN } from '../src/game/runs'

const benchmarkEnabled = (globalThis as typeof globalThis & { process?: { env?: Record<string, string | undefined> } }).process?.env?.RUN_COMBAT_BENCHMARK === '1'
const FRAME_BUDGET_MS = 1_000 / 60

describe.skipIf(!benchmarkEnabled)('combat throughput telemetry', () => {
  for (const enemyCount of [2_000, 5_000]) {
    it(`keeps ${enemyCount} enemy fixed ticks within a 60 FPS frame budget`, () => {
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
      expect(telemetry.averageStepMs).toBeLessThan(FRAME_BUDGET_MS)
    })
  }

  it('streams 50000 enemies through bounded 5000-enemy cohorts', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const state = createSimulation([], rules, 100, GREEN_MARCH)
    state.spawnTimer = 999
    const context = { map: GREEN_MARCH, pathInfos: GREEN_MARCH.paths.map(buildPathInfo), rules, towers: [], run: DEFAULT_RUN }
    const cohortSize = 5_000
    const cohortCount = 10
    let peakAlive = 0
    let ticks = 0
    const startedAt = performance.now()

    for (let cohort = 0; cohort < cohortCount; cohort += 1) {
      spawnStressEnemies(state, GREEN_MARCH, rules, cohortSize)
      peakAlive = Math.max(peakAlive, state.enemies.length)
      for (let tick = 0; tick < 6; tick += 1) {
        stepSimulation(state, context, SIMULATION_STEP)
        ticks += 1
      }
      for (const enemy of state.enemies) enemy.health = 0
      stepSimulation(state, context, SIMULATION_STEP)
      ticks += 1
    }

    const elapsedMs = performance.now() - startedAt
    const averageStepMs = elapsedMs / ticks
    console.info(`[combat-stream-benchmark] ${JSON.stringify({
      totalStreamed: cohortSize * cohortCount,
      peakAlive,
      ticks,
      elapsedMs: Number(elapsedMs.toFixed(2)),
      averageStepMs: Number(averageStepMs.toFixed(3)),
    })}`)
    expect(state.nextEnemyId - 1).toBe(50_000)
    expect(peakAlive).toBe(5_000)
    expect(state.enemies).toHaveLength(0)
    expect(averageStepMs).toBeLessThan(FRAME_BUDGET_MS)
  })
})
