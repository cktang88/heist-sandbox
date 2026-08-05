import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING } from './config'
import { createSimulation, interpolatedEnemyPosition, stepSimulation, syncWalls, type Enemy } from './combat'
import { buildPathInfo } from './path'
import { DEFAULT_RUN } from './runs'
import type { MapDefinition, Placement } from './types'

const map: MapDefinition = {
  id: 'combat-navigation', name: 'Combat Navigation', width: 12, depth: 8, pathWidth: 1.4,
  paths: [[{ x: -6, z: 0 }, { x: 6, z: 0 }]],
}
const contextFor = (rules: ReturnType<typeof createBaseGameRules>) => ({
  map, pathInfos: map.paths.map(buildPathInfo), rules, towers: [] as Placement[], run: DEFAULT_RUN,
})

describe('combat flow navigation', () => {
  it('detours around a partial wall without damaging it', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const wall: Placement = { id: 201, kind: 'wall', temporary: true, x: 0, z: 0 }
    const state = createSimulation([wall], rules, 100, map)
    state.spawnTimer = 999
    state.enemies.push(enemyAt(-3, 0))
    let maxOffset = 0
    for (let tick = 0; tick < 150; tick += 1) {
      stepSimulation(state, contextFor(rules), 1 / 30)
      maxOffset = Math.max(maxOffset, Math.abs(state.enemies[0]?.z ?? 0))
    }
    expect(state.enemies[0]?.x).toBeGreaterThan(1)
    expect(maxOffset).toBeGreaterThan(0.5)
    expect(state.wallById.get(wall.id)?.health).toBe(DEFAULT_TUNING.wall.health)
  })

  it('approaches and attacks the responsible wall when the corridor is sealed', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    rules.wall.length = 3
    const wall: Placement = { id: 202, kind: 'wall', temporary: true, x: 0, z: 0 }
    const state = createSimulation([wall], rules, 100, map)
    state.spawnTimer = 999
    state.enemies.push(enemyAt(-3, 0))
    for (let tick = 0; tick < 100; tick += 1) stepSimulation(state, contextFor(rules), 1 / 30)
    expect(state.wallById.get(wall.id)?.health).toBeLessThan(DEFAULT_TUNING.wall.health)
    expect(state.enemies[0]?.x).toBeLessThan(0)
  })

  it('rebuilds only after wall topology changes', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const state = createSimulation([], rules, 100, map)
    state.spawnTimer = 999
    state.enemies.push(enemyAt(-3, 0))
    stepSimulation(state, contextFor(rules), 1 / 30)
    stepSimulation(state, contextFor(rules), 1 / 30)
    expect(state.navigationCache?.rebuilds).toBe(1)
    syncWalls(state, [], rules, map)
    stepSimulation(state, contextFor(rules), 1 / 30)
    expect(state.navigationCache?.rebuilds).toBe(1)
    syncWalls(state, [{ id: 203, kind: 'wall', temporary: true, x: 0, z: 0 }], rules, map)
    stepSimulation(state, contextFor(rules), 1 / 30)
    expect(state.navigationCache?.rebuilds).toBe(2)
  })

  it('spreads enemies that begin in the same dense pack', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const state = createSimulation([], rules, 100, map)
    state.spawnTimer = 999
    state.enemies.push(enemyAt(-3, 0, 210), enemyAt(-3, 0, 211))
    stepSimulation(state, contextFor(rules), 1 / 30)
    expect(Math.hypot(state.enemies[0].x - state.enemies[1].x, state.enemies[0].z - state.enemies[1].z)).toBeGreaterThan(0.01)
  })

  it('keeps previous positions for render-frame interpolation', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const state = createSimulation([], rules, 100, map)
    state.spawnTimer = 999
    state.enemies.push(enemyAt(-3, 0))
    stepSimulation(state, contextFor(rules), 1 / 30)
    const enemy = state.enemies[0]
    expect(interpolatedEnemyPosition(enemy, 0)).toEqual({ x: -3, z: 0 })
    expect(interpolatedEnemyPosition(enemy, 1)).toEqual({ x: enemy.x, z: enemy.z })
    expect(interpolatedEnemyPosition(enemy, 0.5).x).toBeCloseTo((-3 + enemy.x) / 2)
  })
})

function enemyAt(x: number, z: number, id = 200): Enemy {
  return {
    id, kind: 'grunt', pathIndex: 0, progress: 0, x, z,
    health: DEFAULT_TUNING.enemies.grunt.health, healthMultiplier: 1, speedMultiplier: 1, damageMultiplier: 1,
    status: {
      burnRemaining: 0, burnDamagePerSecond: 0, slowRemaining: 0, slowMultiplier: 1,
      freezeCharge: 0, freezeRemaining: 0, stunRemaining: 0, brittleRemaining: 0,
      armorBreakRemaining: 0, armorBreakAmount: 0,
    },
  }
}
