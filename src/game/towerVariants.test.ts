import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING, TOWER_KINDS } from './config'
import { createSimulation, getTowerStatsForPlacement, stepSimulation, type Enemy } from './combat'
import { GREEN_MARCH } from './maps'
import { buildPathInfo } from './path'
import { DEFAULT_RUN } from './runs'
import { applyTowerVariant, getTowerVariant, getTowerVariants, TOWER_VARIANTS } from './towerVariants'
import type { Placement, TowerKind, TowerVariantId } from './types'

const EXPECTED_IDS: TowerVariantId[] = [
  'gunner-armor-piercer', 'gunner-rapid-feed', 'heavy-anti-armor', 'heavy-siege',
  'cannon-hypervelocity', 'cannon-cluster', 'rocket-guided', 'rocket-salvo',
  'flame-napalm', 'flame-funeral-pyre', 'cryo-brittle', 'cryo-chain-freeze',
  'tesla-stun', 'tesla-overcharge', 'laser-piercing', 'laser-prism',
  'mortar-concussion', 'mortar-cluster', 'support-overclock', 'support-fortress',
]

describe('tower variant catalog', () => {
  it('defines the stable twenty ids and exactly two choices per tower', () => {
    expect(TOWER_VARIANTS.map((variant) => variant.id)).toEqual(EXPECTED_IDS)
    expect(new Set(EXPECTED_IDS).size).toBe(20)
    for (const tower of TOWER_KINDS) expect(getTowerVariants(tower)).toHaveLength(2)
  })

  it('gives every equipped profile its own non-color visual attachment', () => {
    for (const tower of TOWER_KINDS) {
      const variants = getTowerVariants(tower)
      expect(new Set(variants.map((variant) => variant.visual)).size, tower).toBe(variants.length)
      expect(variants.every((variant) => variant.visual.length > 3), tower).toBe(true)
    }
  })

  it('gives every special variant distinct stats without mutating standard tuning', () => {
    for (const variant of TOWER_VARIANTS) {
      const standard = structuredClone(DEFAULT_TUNING.towers[variant.tower])
      const before = structuredClone(standard)
      const changed = applyTowerVariant(variant.tower, variant.id, standard)
      expect(changed, variant.id).not.toEqual(standard)
      expect(standard, `${variant.id} mutated standard stats`).toEqual(before)
      expect(variant.role.length).toBeGreaterThan(8)
      expect(variant.researchNode).toMatch(/^[a-z]+-\d\d$/)
    }
  })

  it('falls back to standard for unknown and wrong-family ids', () => {
    const standard = DEFAULT_TUNING.towers.gunner
    expect(getTowerVariant('gunner', 'not-real')).toBeUndefined()
    expect(getTowerVariant('gunner', 'rocket-salvo')).toBeUndefined()
    expect(applyTowerVariant('gunner', 'not-real', standard)).toEqual(standard)
    expect(applyTowerVariant('gunner', 'rocket-salvo', standard)).toEqual(standard)
  })

  it('applies the selected support model to nearby tower stats', () => {
    const gunner: Placement = { id: 1, kind: 'gunner', x: 0, z: 0 }
    const standardSupport: Placement = { id: 2, kind: 'support', x: 1, z: 0 }
    const overclock: Placement = { ...standardSupport, variantId: 'support-overclock' }
    const standard = getTowerStatsForPlacement(gunner, [gunner, standardSupport], DEFAULT_TUNING)
    const boosted = getTowerStatsForPlacement(gunner, [gunner, overclock], DEFAULT_TUNING)
    expect(boosted.shotsPerSecond).toBeGreaterThan(standard.shotsPerSecond)
    expect(boosted.damage).toBeLessThan(standard.damage)
  })
})

const pathInfos = GREEN_MARCH.paths.map(buildPathInfo)

function enemy(id: number, x: number, z: number, kind: Enemy['kind'] = 'ogre'): Enemy {
  return {
    id, kind, pathIndex: 0, x, z, progress: 0.1,
    health: DEFAULT_TUNING.enemies[kind].health, healthMultiplier: 1, speedMultiplier: 1, damageMultiplier: 1,
    status: { burnRemaining: 0, burnDamagePerSecond: 0, slowRemaining: 0, slowMultiplier: 1, freezeCharge: 0, freezeRemaining: 0, stunRemaining: 0, brittleRemaining: 0, armorBreakRemaining: 0, armorBreakAmount: 0 },
  }
}

function damageWith(tower: Placement, enemies: Enemy[], delta = 0.01): Enemy[] {
  const rules = createBaseGameRules(DEFAULT_TUNING)
  const state = createSimulation([], rules)
  state.spawnTimer = 999
  state.enemies.push(...enemies)
  stepSimulation(state, { map: GREEN_MARCH, pathInfos, rules, towers: [tower], run: DEFAULT_RUN }, delta)
  return enemies
}

describe('tower variant combat switches', () => {
  it('piercing laser hits aligned enemies while standard laser hits one', () => {
    const standardTargets = damageWith({ id: 1, kind: 'laser', x: 0, z: 0 }, [enemy(1, 2, 0), enemy(2, 3, 0)])
    const piercingTargets = damageWith({ id: 2, kind: 'laser', variantId: 'laser-piercing', x: 0, z: 0 }, [enemy(3, 2, 0), enemy(4, 3, 0)])
    expect(standardTargets[1].health).toBe(DEFAULT_TUNING.enemies.ogre.health)
    expect(piercingTargets[1].health).toBeLessThan(DEFAULT_TUNING.enemies.ogre.health)
  })

  it('armor-piercer rivets bypass an armored target reduction', () => {
    const standard = damageWith({ id: 1, kind: 'gunner', x: 0, z: 0 }, [enemy(1, 2, 0, 'armored')])[0]
    const pierced = damageWith({ id: 2, kind: 'gunner', variantId: 'gunner-armor-piercer', x: 0, z: 0 }, [enemy(2, 2, 0, 'armored')])[0]
    const max = DEFAULT_TUNING.enemies.armored.health
    expect(max - pierced.health).toBeGreaterThan(max - standard.health)
  })

  it('stun Tesla stops survivors without requiring the global stun upgrade', () => {
    const target = damageWith({ id: 1, kind: 'tesla', variantId: 'tesla-stun', x: 0, z: 0 }, [enemy(1, 2, 0)])[0]
    expect(target.status.stunRemaining).toBeCloseTo(0.55)
  })

  it('chain freeze jumps to the nearest live enemy in range without touching distant enemies', () => {
    const rules = createBaseGameRules(structuredClone(DEFAULT_TUNING))
    const cryo = rules.tuning.towers.cryo.attack
    if (cryo.kind !== 'cryo') throw new Error('Expected cryo tower stats')
    cryo.freezeThreshold = 1
    const primary = enemy(1, 1, 0)
    const neighbor = enemy(2, 1.4, 0)
    const distant = enemy(3, 4, 0)
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(primary, neighbor, distant)
    const tower: Placement = { id: 1, kind: 'cryo', variantId: 'cryo-chain-freeze', x: 0, z: 0 }

    stepSimulation(state, { map: GREEN_MARCH, pathInfos, rules, towers: [tower], run: DEFAULT_RUN }, 0.01)

    expect(primary.status.freezeRemaining).toBeGreaterThan(0)
    expect(neighbor.status.freezeRemaining).toBeGreaterThan(0)
    expect(distant.status.freezeRemaining).toBe(0)
  })

  it('Funeral Pyre spreads burn from a victim without the global spread upgrade', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    const victim = enemy(1, 1, 0, 'runner')
    const bystander = enemy(2, 1, 0.9, 'ogre')
    victim.health = 1
    const state = createSimulation([], rules)
    state.spawnTimer = 999
    state.enemies.push(victim, bystander)
    const pyre: Placement = { id: 1, kind: 'flamethrower', variantId: 'flame-funeral-pyre', x: 0, z: 0 }

    stepSimulation(state, { map: GREEN_MARCH, pathInfos, rules, towers: [pyre], run: DEFAULT_RUN }, 0.01)
    stepSimulation(state, { map: GREEN_MARCH, pathInfos, rules, towers: [], run: DEFAULT_RUN }, 0.01)

    expect(bystander.status.burnRemaining).toBeGreaterThan(0)
  })

  it('wrong-family selections retain standard combat stats', () => {
    const placement: Placement = { id: 1, kind: 'gunner', variantId: 'rocket-salvo', x: 0, z: 0 }
    expect(getTowerStatsForPlacement(placement, [placement], DEFAULT_TUNING)).toEqual(DEFAULT_TUNING.towers.gunner)
  })
})
