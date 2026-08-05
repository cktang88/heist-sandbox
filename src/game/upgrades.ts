import { createBaseGameRules } from './config'
import type { ActivePowerKind, BuildTool, GameRules, GameTuning, TowerKind, TowerStats } from './types'

export type UpgradeBranchId = 'gunner' | 'explosives' | 'fire' | 'cryo' | 'energy' | 'artillery' | 'command' | 'air' | 'strategic' | 'fortification'
export type UpgradeTier = '01' | '02' | '03' | '04' | '05' | '06'
export type UpgradeId = `${UpgradeBranchId}-${UpgradeTier}`
export type UpgradeRanks = Partial<Record<UpgradeId, number>>

export type UpgradeNode = {
  id: UpgradeId
  name: string
  effect: string
  rankCosts: readonly number[]
  prerequisite?: UpgradeId
  implemented: boolean
  apply: (rules: GameRules, rank: number) => GameRules
}

export type UpgradeBranch = { id: UpgradeBranchId; name: string; nodes: readonly UpgradeNode[] }

type TuningUpgrade = (tuning: GameTuning, rank: number) => GameTuning

const same = (tuning: GameTuning) => tuning
const power = (base: number, rank: number) => base ** rank
const n = (id: UpgradeId, name: string, effect: string, rankCosts: readonly number[], applyTuning: TuningUpgrade = same, implemented = true): UpgradeNode => ({
  id,
  name,
  effect,
  rankCosts,
  prerequisite: id.endsWith('-01') ? undefined : `${id.slice(0, -2)}${String(Number(id.slice(-2)) - 1).padStart(2, '0')}` as UpgradeId,
  implemented,
  apply: (rules, rank) => ({ ...rules, tuning: applyTuning(rules.tuning, rank) }),
})
const rn = (id: UpgradeId, name: string, effect: string, rankCosts: readonly number[], apply: UpgradeNode['apply']): UpgradeNode => ({
  id,
  name,
  effect,
  rankCosts,
  prerequisite: id.endsWith('-01') ? undefined : `${id.slice(0, -2)}${String(Number(id.slice(-2)) - 1).padStart(2, '0')}` as UpgradeId,
  implemented: true,
  apply,
})

export const UPGRADE_BRANCHES: readonly UpgradeBranch[] = [
  { id: 'gunner', name: 'Gunner', nodes: [
    n('gunner-01', 'Rivet Gun', 'Unlock the standard automatic turret.', [0]),
    n('gunner-02', 'Heavy Rivets', '+10% damage per rank.', [8, 14, 22], (t, r) => tower(t, 'gunner', { damage: t.towers.gunner.damage * power(1.1, r) })),
    n('gunner-03', 'Polished Action', '+8% fire rate per rank.', [12, 20, 30], (t, r) => tower(t, 'gunner', { shotsPerSecond: t.towers.gunner.shotsPerSecond * power(1.08, r) })),
    n('gunner-04', 'Rangefinder', '+7% range per rank.', [12, 20, 30], (t, r) => tower(t, 'gunner', { range: t.towers.gunner.range * power(1.07, r) })),
    rn('gunner-05', 'Piercing Rivets', 'Rivet Guns bypass ballistic armor.', [24], (rules) => behaviorRules(rules, 'armorPiercingRivets')),
    n('gunner-06', 'Twin Feed', 'Twin feed adds +35% fire rate.', [40], (t) => tower(t, 'gunner', { shotsPerSecond: t.towers.gunner.shotsPerSecond * 1.35 })),
  ]},
  { id: 'explosives', name: 'Explosives', nodes: [
    n('explosives-01', 'Blast Cannon', 'Unlock the explosive cannon.', [25]),
    n('explosives-02', 'High Explosive', '+10% cannon damage per rank.', [12, 20, 32], (t, r) => tower(t, 'cannon', { damage: t.towers.cannon.damage * power(1.1, r) })),
    n('explosives-03', 'Wide Bursts', '+8% cannon splash per rank.', [12, 20, 32], (t, r) => attack(t, 'cannon', 'splash', { radius: splash(t, 'cannon').radius * power(1.08, r) })),
    n('explosives-04', 'Hardened Propellant', '+20% cannon projectile speed per rank.', [10, 18, 28], (t, r) => tower(t, 'cannon', { projectileSpeed: (t.towers.cannon.projectileSpeed ?? 7) * power(1.2, r) })),
    rn('explosives-05', 'Cluster Shell', 'Cannon impacts release three secondary bomblets.', [35], (rules) => behaviorRules(rules, 'cannonClusterShells')),
    n('explosives-06', 'Rocket Battery', 'Unlock the long-range rocket battery.', [55]),
  ]},
  { id: 'fire', name: 'Fire', nodes: [
    n('fire-01', 'Flame Thrower', 'Unlock the short-range flame tower.', [25]),
    n('fire-02', 'Long Burn', '+12% burn duration per rank.', [10, 18, 28], (t, r) => attack(t, 'flamethrower', 'flame', { burnSeconds: flame(t).burnSeconds * power(1.12, r) })),
    n('fire-03', 'Hotter Fuel', '+10% fire and burn damage per rank.', [12, 20, 32], (t, r) => attack(tower(t, 'flamethrower', { damage: t.towers.flamethrower.damage * power(1.1, r) }), 'flamethrower', 'flame', { burnDamagePerSecond: flame(t).burnDamagePerSecond * power(1.1, r) })),
    n('fire-04', 'Wide Nozzle', '+10% flame radius per rank.', [10, 18, 28], (t, r) => attack(t, 'flamethrower', 'flame', { radius: flame(t).radius * power(1.1, r) })),
    n('fire-05', 'Sticky Fuel', '+35% burn duration.', [35], (t) => attack(t, 'flamethrower', 'flame', { burnSeconds: flame(t).burnSeconds * 1.35 })),
    rn('fire-06', 'Funeral Pyre', 'Burning enemies spread fire once on death.', [50], (rules) => behaviorRules(rules, 'burningDeathSpread')),
  ]},
  { id: 'cryo', name: 'Cryo', nodes: [
    n('cryo-01', 'Cryo Projector', 'Unlock the slowing cryo tower.', [25]),
    n('cryo-02', 'Deep Chill', 'Increase slow strength per rank.', [10, 18, 28], (t, r) => attack(t, 'cryo', 'cryo', { slowMultiplier: Math.max(0.2, cryo(t).slowMultiplier - 0.05 * r) })),
    n('cryo-03', 'Flash Freeze', '+12% freeze buildup per rank.', [12, 20, 32], (t, r) => attack(t, 'cryo', 'cryo', { freezePerHit: cryo(t).freezePerHit * power(1.12, r) })),
    n('cryo-04', 'Cold Snap', '+10% freeze duration per rank.', [12, 20, 32], (t, r) => attack(t, 'cryo', 'cryo', { freezeSeconds: cryo(t).freezeSeconds * power(1.1, r) })),
    rn('cryo-05', 'Brittle Ice', 'Frozen enemies take +35% explosive damage.', [35], (rules) => behaviorRules(rules, 'brittleFrozenEnemies')),
    rn('cryo-06', 'Chain Freeze', 'Freeze jumps to one nearby target.', [50], (rules) => behaviorRules(rules, 'chainFreeze')),
  ]},
  { id: 'energy', name: 'Energy', nodes: [
    n('energy-01', 'Tesla Coil', 'Unlock the chaining Tesla Coil.', [30]), n('energy-02', 'Forked Current', '+1 chain target per rank.', [14, 24], (t, r) => attack(t, 'tesla', 'chain', { targets: chain(t).targets + r })), n('energy-03', 'Overvoltage', '+10% electric damage per rank.', [12, 20, 32], (t, r) => tower(t, 'tesla', { damage: t.towers.tesla.damage * power(1.1, r) })), rn('energy-04', 'Capacitor Shock', 'Tesla hits briefly stun chained targets.', [35], (rules) => behaviorRules(rules, 'teslaStun')), n('energy-05', 'Laser', 'Unlock the continuous Laser and Orbital Laser power.', [55]), rn('energy-06', 'Piercing Beam', 'Laser beams pierce up to three enemies behind the target.', [65], (rules) => behaviorRules(rules, 'piercingLaser')),
  ]},
  { id: 'artillery', name: 'Artillery', nodes: [
    n('artillery-01', 'Mortar', 'Unlock the arcing mortar.', [30]), n('artillery-02', 'Larger Charges', '+10% mortar splash per rank.', [12, 20, 32], (t, r) => attack(t, 'mortar', 'splash', { radius: splash(t, 'mortar').radius * power(1.1, r) })), n('artillery-03', 'Autoloader', '+8% mortar fire rate per rank.', [12, 20, 32], (t, r) => tower(t, 'mortar', { shotsPerSecond: t.towers.mortar.shotsPerSecond * power(1.08, r) })), n('artillery-04', 'Close Support', '-20% mortar minimum range per rank.', [10, 18, 28], (t, r) => tower(t, 'mortar', { minRange: (t.towers.mortar.minRange ?? 2.4) * power(0.8, r) })), rn('artillery-05', 'Concussion Shell', 'Mortar blasts briefly stun survivors.', [35], (rules) => behaviorRules(rules, 'mortarStun')), rn('artillery-06', 'Cluster Mortar', 'Mortar impacts release three secondary bomblets.', [55], (rules) => behaviorRules(rules, 'mortarClusterShells')),
  ]},
  { id: 'command', name: 'Command', nodes: [
    n('command-01', 'Supply Requisition', '+15 starting supply per rank.', [8, 16, 26], (t, r) => ({ ...t, budget: t.budget + 15 * r })),
    n('command-02', 'Efficient Logistics', 'Reduce setup tower and wall costs by 5% per rank.', [10, 18], reduceSetupCosts),
    rn('command-03', 'Expanded Loadout', 'Add a fourth tower loadout slot.', [30], (rules, rank) => ({ ...rules, setup: { ...rules.setup, towerSlots: 3 + rank } })),
    n('command-04', 'Support Beacon', 'Unlock the Support Beacon and Emergency Repair power.', [40]),
    n('command-05', 'Improved Aura', '+15% support strength per rank.', [18, 30], (t, r) => attack(t, 'support', 'support', { damageMultiplier: 1 + (support(t).damageMultiplier - 1) * power(1.15, r), fireRateMultiplier: 1 + (support(t).fireRateMultiplier - 1) * power(1.15, r) })),
    rn('command-06', 'Fortress Shield', 'Begin with 25 shield per rank; rank 2 adds a second Emergency Repair charge.', [45, 65], (rules, rank) => ({
      ...rules,
      setup: { ...rules.setup, fortressShield: 25 * rank },
      powerCharges: { ...rules.powerCharges, repair: rank >= 2 ? 2 : 1 },
    })),
  ]},
  { id: 'air', name: 'Air Support', nodes: [
    n('air-01', 'Aircraft Strafe', 'Unlock aircraft strafing runs.', [20]),
    rn('air-02', 'Second Sortie', '+1 Strafe charge.', [25], (rules, rank) => ({ ...rules, powerCharges: { ...rules.powerCharges, strafe: 1 + rank } })),
    rn('air-03', 'Broad Attack Run', '+15% Strafe width per rank.', [12, 22], (rules, rank) => powerRules(rules, 'strafe', { size: rules.powers.strafe.size * power(1.15, rank) })),
    rn('air-04', 'Heavy Ordnance', '+12% Strafe damage per rank.', [14, 24, 36], (rules, rank) => powerRules(rules, 'strafe', { damage: rules.powers.strafe.damage * power(1.12, rank) })),
    rn('air-05', 'Fast Turnaround', '-10% Strafe cooldown per rank.', [16, 28, 42], (rules, rank) => powerRules(rules, 'strafe', { cooldown: rules.powers.strafe.cooldown * power(0.9, rank) })),
    rn('air-06', 'Depleted Rivets', 'Strafe applies 4 seconds of armor break.', [45], (rules) => behaviorRules(rules, 'strafeArmorBreak')),
  ]},
  { id: 'strategic', name: 'Strategic', nodes: [
    n('strategic-01', 'Artillery Barrage', 'Unlock a targeted barrage.', [30]),
    rn('strategic-02', 'Extra Salvo', '+2 Barrage impacts per rank.', [16, 28], (rules, rank) => powerRules(rules, 'barrage', { impactCount: rules.powers.barrage.impactCount + 2 * rank })),
    n('strategic-03', 'Cryo Beam', 'Unlock the orbital cryo beam.', [40]), rn('strategic-04', 'Frozen Ground', 'Cryo Beam leaves a damaging slow field for 6 seconds.', [40], (rules) => behaviorRules(rules, 'cryoFrozenGround')), n('strategic-05', 'Tactical Nuke', 'Unlock the tactical nuke.', [70]), rn('strategic-06', 'Fallout', 'Nuke fallout damages survivors for 8 seconds.', [65], (rules) => behaviorRules(rules, 'nukeFallout')),
  ]},
  { id: 'fortification', name: 'Fortification', nodes: [
    n('fortification-01', 'Temporary Walls', 'Unlock temporary combat walls.', [15]),
    n('fortification-02', 'Reinforced Panels', '+15% wall health per rank.', [8, 14, 22], (t, r) => ({ ...t, wall: { ...t.wall, health: t.wall.health * power(1.15, r) } })),
    rn('fortification-03', 'Reserve Sections', '+1 wall charge per rank.', [16, 28], (rules, rank) => ({ ...rules, wall: { ...rules.wall, charges: rules.wall.charges + rank } })),
    rn('fortification-04', 'Long Sections', '+25% wall length per rank.', [12, 22], (rules, rank) => ({ ...rules, wall: { ...rules.wall, length: rules.wall.length + 0.25 * rank } })),
    rn('fortification-05', 'Barbed Plate', '+10 contact damage per second per rank.', [24, 36], (rules, rank) => ({ ...behaviorRules(rules, 'wallSpikes'), wall: { ...rules.wall, contactDamagePerSecond: rules.wall.contactDamagePerSecond + 10 * rank } })),
    rn('fortification-06', 'Last Surprise', 'Destroyed walls explode for 70 damage.', [50], (rules) => ({ ...behaviorRules(rules, 'wallBreakExplosion'), wall: { ...rules.wall, breakExplosionDamage: 70 } })),
  ]},
]

export const ALL_UPGRADES = UPGRADE_BRANCHES.flatMap((branch) => branch.nodes)
export const STARTER_UPGRADES: UpgradeRanks = { 'gunner-01': 1 }

const BUILD_UNLOCKS: Record<BuildTool, UpgradeId> = {
  gunner: 'gunner-01', heavyGun: 'gunner-06', cannon: 'explosives-01', rocket: 'explosives-06',
  flamethrower: 'fire-01', cryo: 'cryo-01', tesla: 'energy-01', laser: 'energy-05',
  mortar: 'artillery-01', support: 'command-04', wall: 'fortification-01',
}

const POWER_UNLOCKS: Record<ActivePowerKind, UpgradeId> = {
  strafe: 'air-01', barrage: 'strategic-01', cryoBeam: 'strategic-03', nuke: 'strategic-05',
  orbitalLaser: 'energy-05', repair: 'command-04',
}

export function getRank(ranks: UpgradeRanks, id: UpgradeId): number { return ranks[id] ?? 0 }
export function ownsUpgrade(ranks: UpgradeRanks, id: UpgradeId): boolean { return getRank(ranks, id) > 0 }
export function isBuildToolUnlocked(ranks: UpgradeRanks, kind: BuildTool): boolean { return ownsUpgrade(ranks, BUILD_UNLOCKS[kind]) }
export function isPowerUnlocked(ranks: UpgradeRanks, kind: ActivePowerKind): boolean { return ownsUpgrade(ranks, POWER_UNLOCKS[kind]) }
export function getNextRankCost(ranks: UpgradeRanks, node: UpgradeNode): number | undefined { return node.rankCosts[getRank(ranks, node.id)] }
export function isMaxRank(ranks: UpgradeRanks, node: UpgradeNode): boolean { return getRank(ranks, node.id) >= node.rankCosts.length }

export function getPurchasePrerequisite(node: UpgradeNode): UpgradeId | undefined {
  let prerequisite = node.prerequisite
  while (prerequisite) {
    const candidate = ALL_UPGRADES.find((upgrade) => upgrade.id === prerequisite)
    if (!candidate) return undefined
    if (candidate.implemented) return candidate.id
    prerequisite = candidate.prerequisite
  }
  return undefined
}

export function canPurchaseUpgrade(ranks: UpgradeRanks, medals: number, node: UpgradeNode): boolean {
  const cost = getNextRankCost(ranks, node)
  const prerequisite = getPurchasePrerequisite(node)
  return node.implemented && cost !== undefined && medals >= cost && (!prerequisite || ownsUpgrade(ranks, prerequisite))
}

export function getPurchasableUpgradeNames(ranks: UpgradeRanks, medals: number): string[] {
  return ALL_UPGRADES.filter((node) => canPurchaseUpgrade(ranks, medals, node)).map((node) => node.name)
}

export function getNewlyAffordableUpgradeNames(ranks: UpgradeRanks, previousMedals: number, currentMedals: number): string[] {
  const previouslyAffordable = new Set(getPurchasableUpgradeNames(ranks, previousMedals))
  return getPurchasableUpgradeNames(ranks, currentMedals).filter((name) => !previouslyAffordable.has(name))
}

export function purchaseUpgrade(ranks: UpgradeRanks, medals: number, id: UpgradeId): { ranks: UpgradeRanks; medals: number } | null {
  const node = ALL_UPGRADES.find((candidate) => candidate.id === id)
  if (!node || !canPurchaseUpgrade(ranks, medals, node)) return null
  const cost = getNextRankCost(ranks, node)!
  return { ranks: { ...ranks, [id]: getRank(ranks, id) + 1 }, medals: medals - cost }
}

export function respecUpgrades(ranks: UpgradeRanks, medals: number): { ranks: UpgradeRanks; medals: number } {
  const refund = ALL_UPGRADES.reduce((sum, node) => sum + node.rankCosts.slice(0, getRank(ranks, node.id)).reduce((cost, value) => cost + value, 0), 0)
  return { ranks: { ...STARTER_UPGRADES }, medals: medals + refund }
}

export function deriveGameRules(tuning: GameTuning, ranks: UpgradeRanks): GameRules {
  return ALL_UPGRADES.reduce((result, node) => {
    const rank = getRank(ranks, node.id)
    return rank > 0 ? node.apply(result, rank) : result
  }, createBaseGameRules(tuning))
}

/** Compatibility helper for tuning-only callers such as the Armory comparison. */
export function applyUpgrades(tuning: GameTuning, ranks: UpgradeRanks): GameTuning {
  return deriveGameRules(tuning, ranks).tuning
}

export function sanitizeUpgradeRanks(value: unknown): UpgradeRanks {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const ranks = ALL_UPGRADES.reduce<UpgradeRanks>((result, node) => {
    const raw = candidate[node.id]
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      const rank = Math.max(0, Math.min(node.rankCosts.length, Math.floor(raw)))
      if (rank > 0) result[node.id] = rank
    }
    return result
  }, {})
  ranks['gunner-01'] = Math.max(1, ranks['gunner-01'] ?? 0)
  return ranks
}

function tower(tuning: GameTuning, kind: TowerKind, patch: Partial<TowerStats>): GameTuning {
  return { ...tuning, towers: { ...tuning.towers, [kind]: { ...tuning.towers[kind], ...patch } } }
}

function reduceSetupCosts(tuning: GameTuning, rank: number): GameTuning {
  const multiplier = 1 - rank * 0.05
  const towers = Object.fromEntries(
    (Object.entries(tuning.towers) as [TowerKind, TowerStats][])
      .map(([kind, stats]) => [kind, { ...stats, cost: stats.cost * multiplier }]),
  ) as GameTuning['towers']
  return { ...tuning, towers, wall: { ...tuning.wall, cost: tuning.wall.cost * multiplier } }
}

function attack<K extends TowerStats['attack']['kind']>(tuning: GameTuning, towerKind: TowerKind, attackKind: K, patch: Partial<Extract<TowerStats['attack'], { kind: K }>>): GameTuning {
  const current = tuning.towers[towerKind].attack
  if (current.kind !== attackKind) return tuning
  return tower(tuning, towerKind, { attack: { ...current, ...patch } as TowerStats['attack'] })
}

function splash(tuning: GameTuning, kind: TowerKind) { return tuning.towers[kind].attack as Extract<TowerStats['attack'], { kind: 'splash' }> }
function flame(tuning: GameTuning) { return tuning.towers.flamethrower.attack as Extract<TowerStats['attack'], { kind: 'flame' }> }
function cryo(tuning: GameTuning) { return tuning.towers.cryo.attack as Extract<TowerStats['attack'], { kind: 'cryo' }> }
function chain(tuning: GameTuning) { return tuning.towers.tesla.attack as Extract<TowerStats['attack'], { kind: 'chain' }> }
function support(tuning: GameTuning) { return tuning.towers.support.attack as Extract<TowerStats['attack'], { kind: 'support' }> }

function powerRules(rules: GameRules, kind: ActivePowerKind, patch: Partial<GameRules['powers'][ActivePowerKind]>): GameRules {
  return { ...rules, powers: { ...rules.powers, [kind]: { ...rules.powers[kind], ...patch } } }
}

function behaviorRules(rules: GameRules, behavior: keyof GameRules['behaviors']): GameRules {
  return { ...rules, behaviors: { ...rules.behaviors, [behavior]: true } }
}
