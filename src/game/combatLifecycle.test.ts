import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING } from './config'
import { applyFortressDamage, createSimulation, findTowerTarget, isRunWon, stepSimulation, toSnapshot, type Enemy } from './combat'
import { GREEN_MARCH } from './maps'
import { buildPathInfo } from './path'
import type { Placement, RunRules, TowerKind } from './types'

const rules = createBaseGameRules(DEFAULT_TUNING)
const oneEnemyRun: RunRules = {
  mode: 'sandbox',
  waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 0.1 }], intermission: 0.1 }],
}

function context(towers: Placement[] = [], run: RunRules = oneEnemyRun) {
  return {
    map: GREEN_MARCH,
    pathInfos: GREEN_MARCH.paths.map(buildPathInfo),
    rules,
    towers,
    run,
  }
}

function enemy(id: number, overrides: Partial<Enemy> = {}): Enemy {
  return {
    id,
    kind: 'brute',
    pathIndex: 0,
    x: -5,
    z: -4,
    progress: 0.1,
    health: DEFAULT_TUNING.enemies.brute.health,
    healthMultiplier: 1,
    speedMultiplier: 1,
    damageMultiplier: 1,
    status: {
      burnRemaining: 0,
      burnDamagePerSecond: 0,
      slowRemaining: 0,
      slowMultiplier: 1,
      freezeCharge: 0,
      freezeRemaining: 10,
      stunRemaining: 0,
      brittleRemaining: 0,
      armorBreakRemaining: 0,
      armorBreakAmount: 0,
    },
    ...overrides,
  }
}

function quietState() {
  const state = createSimulation([], rules)
  state.spawnTimer = 999
  return state
}

describe('combat lifecycle invariants', () => {
  it.each([
    ['gunner', 2],
    ['heavyGun', 2],
    ['cannon', 3],
    ['rocket', 3],
    ['flamethrower', 2],
    ['cryo', 2],
    ['tesla', 2],
    ['laser', 3],
    ['mortar', 3],
  ] satisfies [TowerKind, number][])('%s reduces enemy health or kills it', (kind, distance) => {
    const state = quietState()
    const target = enemy(1, { x: distance, z: 0 })
    const tower: Placement = { id: 10, kind, x: 0, z: 0 }
    state.enemies.push(target)

    stepSimulation(state, context([tower]), 0.01)
    // Projectile towers resolve their queued impact on the following step.
    stepSimulation(state, context([tower]), 1)

    expect(target.health < DEFAULT_TUNING.enemies.brute.health || state.defeated === 1).toBe(true)
    expect(state.damageByTower[kind]).toBeGreaterThan(0)
  })

  it('keeps a support beacon non-damaging while it buffs an offensive tower', () => {
    const target = enemy(2, { x: 2, z: 0 })
    const alone = quietState()
    alone.enemies.push(structuredClone(target))
    stepSimulation(alone, context([{ id: 20, kind: 'gunner', x: 0, z: 0 }]), 0.01)

    const supported = quietState()
    supported.enemies.push(structuredClone(target))
    stepSimulation(supported, context([
      { id: 21, kind: 'gunner', x: 0, z: 0 },
      { id: 22, kind: 'support', x: 0.5, z: 0 },
    ]), 0.01)

    expect(supported.enemies[0].health).toBeLessThan(alone.enemies[0].health)
    expect(supported.damageByTower.support).toBe(0)
  })

  it('counts a death once and compacts the same enemy array in place', () => {
    const state = quietState()
    const enemiesReference = state.enemies
    state.enemies.push(enemy(30, { health: 1, x: 2, z: 0 }))
    const tower: Placement = { id: 30, kind: 'gunner', x: 0, z: 0 }

    stepSimulation(state, context([tower]), 0.01)
    expect(state.enemies).toBe(enemiesReference)
    expect(state.enemies).toHaveLength(0)
    expect(state.defeated).toBe(1)

    stepSimulation(state, context([tower]), 0.5)
    expect(state.defeated).toBe(1)
    expect(state.visuals.filter((visual) => visual.kind === 'death')).toHaveLength(1)
  })

  it('leaks once, removes the orc, and spends shield before fortress health', () => {
    const state = createSimulation([], { ...rules, setup: { ...rules.setup, fortressShield: 5 } }, 20)
    state.spawnTimer = 999
    const fortress = GREEN_MARCH.paths[0].at(-1)!
    state.enemies.push(enemy(40, {
      kind: 'grunt',
      health: DEFAULT_TUNING.enemies.grunt.health,
      x: fortress.x,
      z: fortress.z,
      damageMultiplier: 2,
      status: { ...enemy(0).status, freezeRemaining: 0 },
    }))

    stepSimulation(state, context(), 0.01)
    expect(state.enemies).toHaveLength(0)
    expect(state.leaks).toBe(1)
    expect(state.defeated).toBe(0)
    expect(state.fortressShield).toBe(0)
    expect(state.baseHealth).toBe(17)

    stepSimulation(state, context(), 0.01)
    expect(state.leaks).toBe(1)
    expect(state.eventTotals.leaks).toBe(1)
  })

  it('clamps fortress damage and exposes defeat-relevant zero health', () => {
    const fortress = { baseHealth: 7, fortressShield: 2 }
    applyFortressDamage(fortress, 100)
    expect(fortress).toEqual({ baseHealth: 0, fortressShield: 0 })
    applyFortressDamage(fortress, -10)
    expect(fortress).toEqual({ baseHealth: 0, fortressShield: 0 })
  })

  it('ticks damage and control statuses without allowing negative timers', () => {
    const state = quietState()
    const burning = enemy(50, {
      health: 100,
      status: {
        burnRemaining: 0.5,
        burnDamagePerSecond: 10,
        slowRemaining: 0.2,
        slowMultiplier: 0.5,
        freezeCharge: 2,
        freezeRemaining: 0.2,
        stunRemaining: 0.2,
        brittleRemaining: 0.2,
        armorBreakRemaining: 0.2,
        armorBreakAmount: 0.25,
      },
    })
    state.enemies.push(burning)

    stepSimulation(state, context(), 0.3)

    expect(burning.health).toBeCloseTo(97)
    expect(burning.status).toMatchObject({
      slowRemaining: 0,
      freezeRemaining: 0,
      stunRemaining: 0,
      brittleRemaining: 0,
      armorBreakRemaining: 0,
    })
  })

  it('spawns a finite wave, waits for its survivor, then reports victory after cleanup', () => {
    const state = createSimulation([], rules)
    state.spawnTimer = 0
    stepSimulation(state, context(), 0.01)
    expect(state.spawned).toBe(1)
    expect(state.enemies).toHaveLength(1)
    expect(isRunWon(state, oneEnemyRun)).toBe(false)

    state.enemies[0].health = 0
    stepSimulation(state, context(), 0.01)
    stepSimulation(state, context(), 0.01)

    expect(state.waveIndex).toBe(1)
    expect(isRunWon(state, oneEnemyRun)).toBe(true)
    expect(toSnapshot(state, oneEnemyRun)).toMatchObject({ enemiesAlive: 0, wavesCleared: 1 })
  })

  it('never leaves stale or undefined spatial-index targets after in-place compaction', () => {
    const state = quietState()
    state.enemies.push(
      enemy(60, { health: 0, x: 0.5, z: 0 }),
      enemy(61, { x: 1, z: 0 }),
      enemy(62, { health: 0, x: 1.5, z: 0 }),
    )

    stepSimulation(state, context(), 0.01)

    expect(state.enemies.map(({ id }) => id)).toEqual([61])
    expect(() => findTowerTarget({ id: 60, kind: 'gunner', x: 0, z: 0 }, state.enemies, 5, 0, state.enemyIndex)).not.toThrow()
    expect(findTowerTarget({ id: 61, kind: 'gunner', x: 0, z: 0 }, state.enemies, 5, 0, state.enemyIndex)?.id).toBe(61)
  })
})
