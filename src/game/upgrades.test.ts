import { describe, expect, it } from 'vitest'
import { DEFAULT_TUNING, POWERS } from './config'
import type { ActivePowerKind, BuildTool } from './types'
import { TOWER_VARIANTS } from './towerVariants'
import { ALL_UPGRADES, applyUpgrades, deriveGameRules, getNewlyAffordableUpgradeNames, getPurchasableUpgradeNames, getPurchasePrerequisite, isBuildToolUnlocked, isPowerUnlocked, purchaseUpgrade, respecUpgrades, sanitizeUpgradeRanks, STARTER_UPGRADES, UPGRADE_BRANCHES, type UpgradeId } from './upgrades'

describe('gunner upgrades', () => {
  it('enforces cost and prerequisites', () => {
    expect(purchaseUpgrade(STARTER_UPGRADES, 7, 'gunner-02')).toBeNull()
    expect(purchaseUpgrade({}, 100, 'gunner-03')).toBeNull()
    expect(purchaseUpgrade(STARTER_UPGRADES, 100, 'gunner-03')).not.toBeNull()
    expect(purchaseUpgrade(STARTER_UPGRADES, 8, 'gunner-02')).toEqual({
      ranks: { 'gunner-01': 1, 'gunner-02': 1 }, medals: 0,
    })
  })

  it('composes purchased stat multipliers', () => {
    const tuning = applyUpgrades(DEFAULT_TUNING, {
      'gunner-01': 1, 'gunner-02': 1, 'gunner-03': 1, 'gunner-04': 1, 'gunner-05': 1, 'gunner-06': 1,
    })
    expect(tuning.towers.gunner.damage).toBeCloseTo(DEFAULT_TUNING.towers.gunner.damage * 1.1)
    expect(tuning.towers.gunner.shotsPerSecond).toBeCloseTo(DEFAULT_TUNING.towers.gunner.shotsPerSecond * 1.08)
    expect(tuning.towers.gunner.range).toBeCloseTo(DEFAULT_TUNING.towers.gunner.range * 1.07)
  })

  it('High Explosive improves cannon force as well as damage', () => {
    const tuning = applyUpgrades(DEFAULT_TUNING, { 'explosives-01': 1, 'explosives-02': 1 })
    expect(tuning.towers.cannon.knockbackForce).toBeGreaterThan(DEFAULT_TUNING.towers.cannon.knockbackForce ?? 0)
  })

  it('defines ten complete branches with sixty unique nodes', () => {
    expect(UPGRADE_BRANCHES).toHaveLength(10)
    expect(UPGRADE_BRANCHES.every((branch) => branch.nodes.length === 6)).toBe(true)
    expect(new Set(ALL_UPGRADES.map((node) => node.id)).size).toBe(60)
    expect(ALL_UPGRADES.every((node) => node.implemented)).toBe(true)
  })

  it('charges the correct next-rank cost and caps saved ranks', () => {
    const first = purchaseUpgrade(STARTER_UPGRADES, 100, 'gunner-02')!
    const second = purchaseUpgrade(first.ranks, first.medals, 'gunner-02')!
    expect(first.medals).toBe(92)
    expect(second.medals).toBe(78)
    expect(sanitizeUpgradeRanks({ 'gunner-02': 99, 'fire-02': -4, 'cryo-03': 1.8 })).toEqual({
      'gunner-02': 3, 'cryo-03': 1, 'gunner-01': 1,
    })
  })

  it('refunds bought nodes but keeps the starter unlock', () => {
    expect(respecUpgrades({ 'gunner-01': 1, 'gunner-02': 1, 'gunner-03': 1 }, 2)).toEqual({
      ranks: { 'gunner-01': 1 }, medals: 22,
    })
  })

  it('turns research unlocks into playable tools and powers', () => {
    expect(isBuildToolUnlocked(STARTER_UPGRADES, 'gunner')).toBe(true)
    expect(isBuildToolUnlocked(STARTER_UPGRADES, 'cannon')).toBe(false)
    expect(isBuildToolUnlocked({ ...STARTER_UPGRADES, 'explosives-01': 1 }, 'cannon')).toBe(true)
    expect(isPowerUnlocked({ 'strategic-05': 1 }, 'nuke')).toBe(true)
    expect(isPowerUnlocked({ 'command-04': 1 }, 'repair')).toBe(true)
  })

  it('fans stat and variant choices out from their relevant unlock', () => {
    const prerequisite = (id: (typeof ALL_UPGRADES)[number]['id']) => getPurchasePrerequisite(ALL_UPGRADES.find((node) => node.id === id)!)
    expect(prerequisite('artillery-06')).toBe('artillery-01')
    expect(prerequisite('command-04')).toBeUndefined()
    expect(prerequisite('strategic-03')).toBeUndefined()
    expect(prerequisite('strategic-05')).toBeUndefined()
    expect(prerequisite('strategic-02')).toBe('strategic-01')
    expect(prerequisite('strategic-04')).toBe('strategic-03')
    expect(prerequisite('strategic-06')).toBe('strategic-05')
  })

  it('lets players buy one branch choice without unrelated stat research', () => {
    expect(purchaseUpgrade({ 'explosives-01': 1 }, 100, 'explosives-06')).not.toBeNull()
    expect(purchaseUpgrade({ 'explosives-01': 1 }, 100, 'explosives-05')).not.toBeNull()
    expect(purchaseUpgrade({ 'energy-01': 1 }, 100, 'energy-05')).not.toBeNull()
    expect(purchaseUpgrade({ 'energy-01': 1 }, 100, 'energy-06')).toBeNull()
    expect(purchaseUpgrade({ 'energy-01': 1, 'energy-05': 1 }, 100, 'energy-06')).not.toBeNull()
  })

  it('marks permanent unlock nodes for every tower variant and battlefield power', () => {
    const variantNames = ALL_UPGRADES.flatMap((node) => node.unlocks ?? [])
      .filter((unlock) => unlock.kind === 'variant')
      .map((unlock) => unlock.name)
    expect(variantNames).toEqual([
      'Rapid-Feed Rivet Gun', 'Armor-Piercer Rivet Gun', 'Anti-Armor Heavy Gun', 'Siege Heavy Gun',
      'Hypervelocity Blast Cannon', 'Guided Rocket Battery', 'Cluster Blast Cannon', 'Salvo Rocket Battery',
      'Napalm Flame Thrower', 'Funeral Pyre Flame Thrower', 'Brittle Cryo Projector', 'Chain-Freeze Cryo Projector',
      'Overcharge Tesla Coil', 'Stun Tesla Coil', 'Prism Laser', 'Piercing Laser',
      'Concussion Mortar', 'Cluster Mortar', 'Overclock Support Beacon', 'Fortress Support Beacon',
    ])
    expect(new Set(ALL_UPGRADES.flatMap((node) => node.unlocks ?? []).map((unlock) => unlock.id)).size)
      .toBe(ALL_UPGRADES.flatMap((node) => node.unlocks ?? []).length)
    expect(ALL_UPGRADES.flatMap((node) => node.unlocks ?? []).filter((unlock) => unlock.kind === 'power')).toHaveLength(6)
    expect(ALL_UPGRADES.flatMap((node) => node.unlocks ?? []).filter((unlock) => unlock.kind === 'wall')).toHaveLength(1)
  })

  it('shows every runtime variant on the same research node that unlocks it', () => {
    for (const variant of TOWER_VARIANTS) {
      const node = ALL_UPGRADES.find((upgrade) => upgrade.id === variant.researchNode)
      expect(node?.unlocks?.some((unlock) => unlock.kind === 'variant' && unlock.id === variant.id), variant.id).toBe(true)
    }
  })

  it('keeps every implemented node reachable through purchases', () => {
    for (const branch of UPGRADE_BRANCHES) {
      let ranks = { ...STARTER_UPGRADES }
      for (const node of branch.nodes.filter((candidate) => candidate.implemented)) {
        if (ranks[node.id]) continue
        const purchase = purchaseUpgrade(ranks, 100_000, node.id)
        expect(purchase, `${node.id} should be reachable`).not.toBeNull()
        ranks = purchase!.ranks
      }
    }
  })

  it('adds purchased supply to the effective tuning', () => {
    expect(applyUpgrades(DEFAULT_TUNING, { 'command-01': 2 }).budget).toBe(DEFAULT_TUNING.budget + 30)
  })

  it('reduces every setup cost by exactly five percent per logistics rank', () => {
    for (const rank of [1, 2]) {
      const tuning = applyUpgrades(DEFAULT_TUNING, { 'command-02': rank })
      const multiplier = 1 - rank * 0.05
      for (const kind of Object.keys(DEFAULT_TUNING.towers) as (keyof typeof DEFAULT_TUNING.towers)[]) {
        expect(tuning.towers[kind].cost).toBeCloseTo(DEFAULT_TUNING.towers[kind].cost * multiplier)
      }
      expect(tuning.wall.cost).toBeCloseTo(DEFAULT_TUNING.wall.cost * multiplier)
    }
  })

  it('derives the fourth tower slot and fortress shield ranks', () => {
    expect(deriveGameRules(DEFAULT_TUNING, {}).setup.towerSlots).toBe(3)
    expect(deriveGameRules(DEFAULT_TUNING, { 'command-03': 1 }).setup.towerSlots).toBe(4)
    expect(deriveGameRules(DEFAULT_TUNING, { 'command-06': 1 }).setup.fortressShield).toBe(25)
    expect(deriveGameRules(DEFAULT_TUNING, { 'command-06': 2 }).setup.fortressShield).toBe(50)
  })

  it('can widen firing arcs through weapon research', () => {
    const gunner = deriveGameRules(DEFAULT_TUNING, { 'gunner-04': 2 }).tuning.towers.gunner
    const flame = deriveGameRules(DEFAULT_TUNING, { 'fire-04': 3 }).tuning.towers.flamethrower
    expect(gunner.firingArcDegrees).toBe((DEFAULT_TUNING.towers.gunner.firingArcDegrees ?? 360) + 10)
    expect(flame.firingArcDegrees).toBe((DEFAULT_TUNING.towers.flamethrower.firingArcDegrees ?? 360) + 15)
  })

  it('reports currently purchasable and newly affordable research names', () => {
    expect(getPurchasableUpgradeNames(STARTER_UPGRADES, 7)).toEqual([])
    expect(getNewlyAffordableUpgradeNames(STARTER_UPGRADES, 7, 10)).toEqual(['Heavy Rivets', 'Supply Requisition'])
    expect(getPurchasableUpgradeNames({ ...STARTER_UPGRADES, 'command-01': 1 }, 10)).toContain('Efficient Logistics')
  })

  it('derives stable baseline run rules without mutating tuning defaults', () => {
    const rules = deriveGameRules(DEFAULT_TUNING, STARTER_UPGRADES)
    expect(rules.tuning).toEqual(DEFAULT_TUNING)
    expect(rules.tuning).not.toBe(DEFAULT_TUNING)
    expect(rules.powers).toEqual(POWERS)
    expect(rules.powerCharges).toEqual({
      strafe: 1, barrage: null, cryoBeam: null, nuke: 1, orbitalLaser: null, repair: 1,
    })
    expect(rules.wall).toEqual({
      charges: 2, length: 1, lifetimeSeconds: 15, contactDamagePerSecond: 0, breakExplosionDamage: 0, rechargeSeconds: 6,
    })
    expect(rules.setup).toEqual({
      towerSlots: 3, powerSlots: 3, preparationRefundMultiplier: 1, fortressShield: 0,
    })
    expect(Object.values(rules.behaviors).every((enabled) => !enabled)).toBe(true)
  })

  it('keeps every build and power unlock connected to its research node', () => {
    const buildUnlocks: Record<BuildTool, UpgradeId> = {
      gunner: 'gunner-01', heavyGun: 'gunner-06', cannon: 'explosives-01', rocket: 'explosives-06',
      flamethrower: 'fire-01', cryo: 'cryo-01', tesla: 'energy-01', laser: 'energy-05',
      mortar: 'artillery-01', support: 'command-04', wall: 'fortification-01',
    }
    const powerUnlocks: Record<ActivePowerKind, UpgradeId> = {
      strafe: 'air-01', barrage: 'strategic-01', cryoBeam: 'strategic-03', nuke: 'strategic-05',
      orbitalLaser: 'energy-05', repair: 'command-04',
    }
    for (const [tool, id] of Object.entries(buildUnlocks) as [BuildTool, UpgradeId][]) {
      expect(isBuildToolUnlocked({}, tool), `${tool} should begin locked`).toBe(false)
      expect(isBuildToolUnlocked({ [id]: 1 }, tool), `${id} should unlock ${tool}`).toBe(true)
    }
    for (const [power, id] of Object.entries(powerUnlocks) as [ActivePowerKind, UpgradeId][]) {
      expect(isPowerUnlocked({}, power), `${power} should begin locked`).toBe(false)
      expect(isPowerUnlocked({ [id]: 1 }, power), `${id} should unlock ${power}`).toBe(true)
    }
  })

  it('preserves a derived rule effect for every implemented non-unlock node', () => {
    const unlockOnly = new Set<UpgradeId>([
      'gunner-01', 'gunner-06', 'explosives-01', 'explosives-06', 'fire-01', 'cryo-01', 'energy-01',
      'energy-05', 'artillery-01', 'command-04', 'air-01', 'strategic-01', 'strategic-03',
      'strategic-05', 'fortification-01',
    ])
    const baseline = JSON.stringify(deriveGameRules(DEFAULT_TUNING, STARTER_UPGRADES))
    for (const node of ALL_UPGRADES.filter((candidate) => candidate.implemented && !unlockOnly.has(candidate.id))) {
      const rules = deriveGameRules(DEFAULT_TUNING, { ...STARTER_UPGRADES, [node.id]: 1 })
      expect(JSON.stringify(rules), `${node.id} should still change derived rules`).not.toBe(baseline)
    }
  })

  it('derives every rank of numeric power and wall research', () => {
    expect(deriveGameRules(DEFAULT_TUNING, { 'air-02': 1 }).powerCharges.strafe).toBe(2)
    expect(deriveGameRules(DEFAULT_TUNING, { 'command-06': 1 }).powerCharges.repair).toBe(1)
    expect(deriveGameRules(DEFAULT_TUNING, { 'command-06': 2 }).powerCharges.repair).toBe(2)
    for (const rank of [1, 2]) {
      expect(deriveGameRules(DEFAULT_TUNING, { 'air-03': rank }).powers.strafe.size)
        .toBeCloseTo(POWERS.strafe.size * 1.15 ** rank)
      expect(deriveGameRules(DEFAULT_TUNING, { 'strategic-02': rank }).powers.barrage.impactCount)
        .toBe(POWERS.barrage.impactCount + 2 * rank)
      expect(deriveGameRules(DEFAULT_TUNING, { 'fortification-03': rank }).wall.charges).toBe(2 + rank)
      expect(deriveGameRules(DEFAULT_TUNING, { 'fortification-04': rank }).wall.length).toBe(1 + 0.25 * rank)
    }
    for (const rank of [1, 2, 3]) {
      const rules = deriveGameRules(DEFAULT_TUNING, {
        'air-04': rank, 'air-05': rank, 'explosives-04': rank, 'artillery-04': rank,
      })
      expect(rules.powers.strafe.damage).toBeCloseTo(POWERS.strafe.damage * 1.12 ** rank)
      expect(rules.powers.strafe.cooldown).toBeCloseTo(POWERS.strafe.cooldown * 0.9 ** rank)
      expect(rules.tuning.towers.cannon.projectileSpeed).toBeCloseTo(DEFAULT_TUNING.towers.cannon.projectileSpeed! * 1.2 ** rank)
      expect(rules.tuning.towers.mortar.minRange).toBeCloseTo(DEFAULT_TUNING.towers.mortar.minRange! * 0.8 ** rank)
    }
  })

  it('derives status and penetration research as explicit behavior flags', () => {
    const ids = {
      'gunner-05': 'armorPiercingRivets',
      'cryo-05': 'brittleFrozenEnemies',
      'cryo-06': 'chainFreeze',
      'energy-04': 'teslaStun',
      'energy-06': 'piercingLaser',
      'artillery-05': 'mortarStun',
      'air-06': 'strafeArmorBreak',
      'fire-06': 'burningDeathSpread',
      'strategic-04': 'cryoFrozenGround',
      'strategic-06': 'nukeFallout',
      'fortification-05': 'wallSpikes',
      'fortification-06': 'wallBreakExplosion',
    } as const
    for (const [id, behavior] of Object.entries(ids) as [UpgradeId, (typeof ids)[keyof typeof ids]][]) {
      expect(deriveGameRules(DEFAULT_TUNING, { [id]: 1 }).behaviors[behavior], `${id} should enable ${behavior}`).toBe(true)
    }
  })
})
