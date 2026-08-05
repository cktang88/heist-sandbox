import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING, TOWER_KINDS } from './config'
import { createSimulation, stepSimulation, type Enemy, type SimulationState } from './combat'
import { GREEN_MARCH } from './maps'
import { buildPathInfo } from './path'
import { DEFAULT_RUN } from './runs'
import type { GameRules, Placement, TowerKind } from './types'

const pathInfos = GREEN_MARCH.paths.map(buildPathInfo)

function makeEnemy(id: number, x: number, z: number, kind: Enemy['kind'] = 'ogre'): Enemy {
  return {
    id, kind, pathIndex: 0, x, z, progress: 0.1,
    health: DEFAULT_TUNING.enemies[kind].health,
    healthMultiplier: 1, speedMultiplier: 1, damageMultiplier: 1,
    status: {
      burnRemaining: 0, burnDamagePerSecond: 0, slowRemaining: 0, slowMultiplier: 1,
      freezeCharge: 0, freezeRemaining: 10, stunRemaining: 0,
      brittleRemaining: 0, armorBreakRemaining: 0, armorBreakAmount: 0,
    },
  }
}

function tower(kind: TowerKind, id = 1, x = 0, z = 0): Placement {
  return { id, kind, x, z }
}

function setup(enemies: Enemy[], rules = createBaseGameRules(DEFAULT_TUNING)): SimulationState {
  const state = createSimulation([], rules)
  state.spawnTimer = 999
  state.enemies.push(...enemies)
  return state
}

function step(state: SimulationState, towers: Placement[], rules: GameRules, delta = 0.01): void {
  stepSimulation(state, { map: GREEN_MARCH, pathInfos, rules, towers, run: DEFAULT_RUN }, delta)
}

describe('tower combat contracts', () => {
  it('keeps an explicit combat contract for every configured tower', () => {
    expect(TOWER_KINDS).toEqual([
      'gunner', 'heavyGun', 'cannon', 'rocket', 'flamethrower',
      'cryo', 'tesla', 'laser', 'mortar', 'support',
    ])
  })

  it('Gunner acquires one in-range target and credits its direct damage', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const target = makeEnemy(10, 2, 0)
    const bystander = makeEnemy(11, 2.2, 0.1)
    const state = setup([target, bystander], rules)

    step(state, [tower('gunner')], rules)

    expect(target.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(bystander.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
    expect(state.damageByTower.gunner).toBeGreaterThan(0)
  })

  it('Heavy Gun damages a narrow cone without hitting an off-axis enemy', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const front = makeEnemy(20, 2, 0)
    const behind = makeEnemy(21, 2.5, 0.1)
    const outside = makeEnemy(22, 2, 1)
    const state = setup([front, behind, outside], rules)

    step(state, [tower('heavyGun')], rules)

    expect(front.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(behind.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(outside.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
  })

  it('Blast Cannon fires a delayed projectile and damages a clustered group', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const primary = makeEnemy(30, 3, 0)
    const nearby = makeEnemy(31, 3.5, 0)
    const state = setup([primary, nearby], rules)

    step(state, [tower('cannon')], rules)
    expect(primary.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
    step(state, [], rules, 0.5)

    expect(primary.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(nearby.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(state.damageByTower.cannon).toBeGreaterThan(0)
  })

  it('Rocket Battery respects its dead zone and splashes valid distant targets', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const tooClose = makeEnemy(40, 1, 0)
    const primary = makeEnemy(41, 3, 0)
    const nearby = makeEnemy(42, 3.8, 0)
    const state = setup([tooClose, primary, nearby], rules)

    step(state, [tower('rocket')], rules)

    expect(tooClose.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
    expect(primary.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(nearby.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
  })

  it('Flame Thrower applies direct fire damage and a continuing burn in its cone', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const target = makeEnemy(50, 2, 0)
    const state = setup([target], rules)

    step(state, [tower('flamethrower')], rules)
    const healthAfterHit = target.health
    expect(target.status.burnRemaining).toBeGreaterThan(0)
    expect(target.status.burnDamagePerSecond).toBeGreaterThan(0)

    step(state, [], rules, 0.25)
    expect(target.health).toBeLessThan(healthAfterHit)
  })

  it('Cryo Projector slows, charges, and freezes at its configured threshold', () => {
    const tuning = structuredClone(DEFAULT_TUNING)
    const attack = tuning.towers.cryo.attack
    if (attack.kind !== 'cryo') throw new Error('Expected Cryo Projector to use a cryo attack')
    attack.freezeThreshold = 1
    const rules = createBaseGameRules(tuning)
    const target = makeEnemy(60, 2, 0)
    target.status.freezeRemaining = 0
    const state = setup([target], rules)

    step(state, [tower('cryo')], rules)

    expect(target.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(target.status.slowMultiplier).toBe(attack.slowMultiplier)
    expect(target.status.slowRemaining).toBeGreaterThan(0)
    expect(target.status.freezeRemaining).toBeGreaterThan(0)
  })

  it('Tesla Coil chains damage through nearby enemies but stops at a gap', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const first = makeEnemy(70, 2, 0)
    const second = makeEnemy(71, 3.2, 0)
    const isolated = makeEnemy(72, 5.5, 0)
    const state = setup([first, second, isolated], rules)

    step(state, [tower('tesla')], rules)

    expect(first.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(second.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(isolated.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
  })

  it('Laser Lance increases damage while holding the same target', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const target = makeEnemy(80, 2, 0)
    const state = setup([target], rules)

    step(state, [tower('laser')], rules)
    const firstShot = DEFAULT_TUNING.enemies.ogre.health - target.health
    step(state, [tower('laser')], rules, 1.3)
    const secondShot = DEFAULT_TUNING.enemies.ogre.health - target.health - firstShot

    expect(secondShot).toBeGreaterThan(firstShot)
  })

  it('Field Mortar ignores its dead zone and later splashes a distant cluster', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const tooClose = makeEnemy(90, 1, 0)
    const primary = makeEnemy(91, 4, 0)
    const nearby = makeEnemy(92, 5, 0)
    const state = setup([tooClose, primary, nearby], rules)

    step(state, [tower('mortar')], rules)
    expect(tooClose.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
    step(state, [], rules, 1.1)

    expect(primary.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(nearby.health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
    expect(tooClose.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
  })

  it('Support Beacon never attacks and buffs only a nearby offensive tower', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const baselineTarget = makeEnemy(100, 2, 0)
    const nearTarget = makeEnemy(101, 2, 0)
    const farTarget = makeEnemy(102, 2, 0)
    const supportOnlyTarget = makeEnemy(103, 2, 0)
    const baseline = setup([baselineTarget], rules)
    const near = setup([nearTarget], rules)
    const far = setup([farTarget], rules)
    const supportOnly = setup([supportOnlyTarget], rules)

    step(baseline, [tower('gunner')], rules)
    step(near, [tower('gunner'), tower('support', 2, 1, 0)], rules)
    step(far, [tower('gunner'), tower('support', 3, 8, 0)], rules)
    step(supportOnly, [tower('support')], rules)

    const baseDamage = DEFAULT_TUNING.enemies.ogre.health - baselineTarget.health
    expect(DEFAULT_TUNING.enemies.ogre.health - nearTarget.health).toBeGreaterThan(baseDamage)
    expect(DEFAULT_TUNING.enemies.ogre.health - farTarget.health).toBeCloseTo(baseDamage)
    expect(supportOnlyTarget.health).toBe(DEFAULT_TUNING.enemies.ogre.health)
    expect(supportOnly.eventTotals.shots).toBe(0)
    expect(supportOnly.damageByTower.support).toBe(0)
  })
})
