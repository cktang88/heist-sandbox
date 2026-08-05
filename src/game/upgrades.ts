import { createBaseGameRules } from './config'
import type { ActivePowerKind, BuildTool, GameRules, GameTuning, TowerKind, TowerStats } from './types'

export type UpgradeBranchId = 'gunner' | 'explosives' | 'fire' | 'cryo' | 'energy' | 'artillery' | 'command' | 'air' | 'strategic' | 'fortification'
export type UpgradeId = `${UpgradeBranchId}-${string}`
export type UpgradeRanks = Partial<Record<UpgradeId, number>>
export type UpgradeNodeKind = 'stat' | 'tower' | 'variant' | 'power' | 'wall' | 'doctrine'
export type UpgradeRequirement = { id: UpgradeId; rank: 1 | 'max' }

export type UpgradeNode = {
  id: UpgradeId
  name: string
  effect: string
  rankCosts: readonly number[]
  requirements?: readonly UpgradeRequirement[]
  unlocks?: readonly { id: string; kind: 'tower' | 'power' | 'wall' | 'variant' | 'doctrine'; name: string }[]
  kind: UpgradeNodeKind
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
  kind: 'stat',
  implemented,
  apply: (rules, rank) => ({ ...rules, tuning: applyTuning(rules.tuning, rank) }),
})
const rn = (id: UpgradeId, name: string, effect: string, rankCosts: readonly number[], apply: UpgradeNode['apply']): UpgradeNode => ({
  id,
  name,
  effect,
  rankCosts,
  kind: 'stat',
  implemented: true,
  apply,
})

const BASE_UPGRADE_BRANCHES: readonly UpgradeBranch[] = [
  { id: 'gunner', name: 'Gunner', nodes: [
    n('gunner-01', 'Rivet Gun', 'Unlock the standard automatic turret.', [0]),
    n('gunner-02', 'Heavy Rivets', '+10% damage per rank.', [8, 14, 22], (t, r) => tower(t, 'gunner', { damage: t.towers.gunner.damage * power(1.1, r) })),
    n('gunner-03', 'Polished Action', '+8% fire rate per rank.', [12, 20, 30], (t, r) => tower(t, 'gunner', { shotsPerSecond: t.towers.gunner.shotsPerSecond * power(1.08, r) })),
    n('gunner-04', 'Rangefinder', '+7% range and +5° firing arc per rank.', [12, 20, 30], (t, r) => tower(t, 'gunner', {
      range: t.towers.gunner.range * power(1.07, r),
      firingArcDegrees: Math.min(360, (t.towers.gunner.firingArcDegrees ?? 360) + 5 * r),
    })),
    n('gunner-05', 'Armor Piercer', 'Unlock the slow anti-armor Rivet Gun profile.', [24]),
    n('gunner-06', 'Heavy Gun', 'Unlock the heavy dual-feed turret variant.', [40]),
  ]},
  { id: 'explosives', name: 'Explosives', nodes: [
    n('explosives-01', 'Blast Cannon', 'Unlock the explosive cannon.', [25]),
    n('explosives-02', 'High Explosive', '+10% cannon damage and blast force per rank.', [12, 20, 32], (t, r) => tower(t, 'cannon', {
      damage: t.towers.cannon.damage * power(1.1, r),
      knockbackForce: (t.towers.cannon.knockbackForce ?? 0) * power(1.1, r),
    })),
    n('explosives-03', 'Wide Bursts', '+8% cannon splash per rank.', [12, 20, 32], (t, r) => attack(t, 'cannon', 'splash', { radius: splash(t, 'cannon').radius * power(1.08, r) })),
    n('explosives-04', 'Hardened Propellant', '+20% cannon projectile speed per rank.', [10, 18, 28], (t, r) => tower(t, 'cannon', { projectileSpeed: (t.towers.cannon.projectileSpeed ?? 7) * power(1.2, r) })),
    n('explosives-05', 'Cluster Cannon', 'Unlock the secondary-bomblet Cannon profile.', [35]),
    n('explosives-06', 'Rocket Battery', 'Unlock the long-range rocket battery.', [55]),
  ]},
  { id: 'fire', name: 'Fire', nodes: [
    n('fire-01', 'Flame Thrower', 'Unlock the short-range flame tower.', [25]),
    n('fire-02', 'Long Burn', '+12% burn duration per rank.', [10, 18, 28], (t, r) => attack(t, 'flamethrower', 'flame', { burnSeconds: flame(t).burnSeconds * power(1.12, r) })),
    n('fire-03', 'Hotter Fuel', '+10% fire and burn damage per rank.', [12, 20, 32], (t, r) => attack(tower(t, 'flamethrower', { damage: t.towers.flamethrower.damage * power(1.1, r) }), 'flamethrower', 'flame', { burnDamagePerSecond: flame(t).burnDamagePerSecond * power(1.1, r) })),
    n('fire-04', 'Wide Nozzle', '+10% flame width and +5° firing arc per rank.', [10, 18, 28], (t, r) => attack(
      tower(t, 'flamethrower', { firingArcDegrees: Math.min(360, (t.towers.flamethrower.firingArcDegrees ?? 360) + 5 * r) }),
      'flamethrower', 'flame', { radius: flame(t).radius * power(1.1, r) },
    )),
    n('fire-05', 'Sticky Fuel', '+35% burn duration.', [35], (t) => attack(t, 'flamethrower', 'flame', { burnSeconds: flame(t).burnSeconds * 1.35 })),
    n('fire-06', 'Funeral Pyre', 'Unlock the wide fire-spreading Flame Thrower profile.', [50]),
  ]},
  { id: 'cryo', name: 'Cryo', nodes: [
    n('cryo-01', 'Cryo Projector', 'Unlock the slowing cryo tower.', [25]),
    n('cryo-02', 'Deep Chill', 'Increase slow strength per rank.', [10, 18, 28], (t, r) => attack(t, 'cryo', 'cryo', { slowMultiplier: Math.max(0.2, cryo(t).slowMultiplier - 0.05 * r) })),
    n('cryo-03', 'Flash Freeze', '+12% freeze buildup per rank.', [12, 20, 32], (t, r) => attack(t, 'cryo', 'cryo', { freezePerHit: cryo(t).freezePerHit * power(1.12, r) })),
    n('cryo-04', 'Cold Snap', '+10% freeze duration per rank.', [12, 20, 32], (t, r) => attack(t, 'cryo', 'cryo', { freezeSeconds: cryo(t).freezeSeconds * power(1.1, r) })),
    n('cryo-05', 'Brittle Projector', 'Unlock the explosive-priming Cryo profile.', [35]),
    n('cryo-06', 'Chain-Freeze Projector', 'Unlock the jumping-freeze Cryo profile.', [50]),
  ]},
  { id: 'energy', name: 'Energy', nodes: [
    n('energy-01', 'Tesla Coil', 'Unlock the chaining Tesla Coil.', [30]), n('energy-02', 'Forked Current', '+1 chain target per rank.', [14, 24], (t, r) => attack(t, 'tesla', 'chain', { targets: chain(t).targets + r })), n('energy-03', 'Overvoltage', '+10% electric damage per rank.', [12, 20, 32], (t, r) => tower(t, 'tesla', { damage: t.towers.tesla.damage * power(1.1, r) })), n('energy-04', 'Stun Coil', 'Unlock the horde-stopping Tesla profile.', [35]), n('energy-05', 'Laser', 'Unlock the continuous Laser tower.', [55]), n('energy-06', 'Piercing Laser', 'Unlock the column-piercing Laser profile.', [65]),
  ]},
  { id: 'artillery', name: 'Artillery', nodes: [
    n('artillery-01', 'Mortar', 'Unlock the arcing mortar.', [30]), n('artillery-02', 'Larger Charges', '+10% mortar splash per rank.', [12, 20, 32], (t, r) => attack(t, 'mortar', 'splash', { radius: splash(t, 'mortar').radius * power(1.1, r) })), n('artillery-03', 'Autoloader', '+8% mortar fire rate per rank.', [12, 20, 32], (t, r) => tower(t, 'mortar', { shotsPerSecond: t.towers.mortar.shotsPerSecond * power(1.08, r) })), n('artillery-04', 'Close Support', '-20% mortar minimum range per rank.', [10, 18, 28], (t, r) => tower(t, 'mortar', { minRange: (t.towers.mortar.minRange ?? 2.4) * power(0.8, r) })), n('artillery-05', 'Concussion Mortar', 'Unlock the survivor-stunning Mortar profile.', [35]), n('artillery-06', 'Cluster Mortar', 'Unlock the secondary-shell Mortar profile.', [55]),
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

/**
 * Research is a graph, not a six-step checklist. Most weapon improvements fan out
 * from the weapon unlock so players can choose damage, range, or a variant first.
 */
const PREREQUISITES: Partial<Record<UpgradeId, UpgradeId>> = {
  'gunner-02': 'gunner-01', 'gunner-03': 'gunner-01', 'gunner-04': 'gunner-01', 'gunner-05': 'gunner-02', 'gunner-06': 'gunner-01',
  'explosives-02': 'explosives-01', 'explosives-03': 'explosives-01', 'explosives-04': 'explosives-01', 'explosives-05': 'explosives-03', 'explosives-06': 'explosives-01',
  'fire-02': 'fire-01', 'fire-03': 'fire-01', 'fire-04': 'fire-01', 'fire-05': 'fire-01', 'fire-06': 'fire-04',
  'cryo-02': 'cryo-01', 'cryo-03': 'cryo-01', 'cryo-04': 'cryo-01', 'cryo-05': 'cryo-02', 'cryo-06': 'cryo-03',
  'energy-02': 'energy-01', 'energy-03': 'energy-01', 'energy-04': 'energy-02', 'energy-05': 'energy-01', 'energy-06': 'energy-12',
  'artillery-02': 'artillery-01', 'artillery-03': 'artillery-01', 'artillery-04': 'artillery-01', 'artillery-05': 'artillery-02', 'artillery-06': 'artillery-03',
  'command-02': 'command-01', 'command-03': 'command-01', 'command-05': 'command-04', 'command-06': 'command-04',
  'air-02': 'air-01', 'air-03': 'air-01', 'air-04': 'air-01', 'air-05': 'air-01', 'air-06': 'air-01',
  'strategic-02': 'strategic-01', 'strategic-04': 'strategic-03', 'strategic-06': 'strategic-05',
  'fortification-02': 'fortification-01', 'fortification-03': 'fortification-01', 'fortification-04': 'fortification-01', 'fortification-05': 'fortification-01', 'fortification-06': 'fortification-01',
}

const CORE_UNLOCKS: Partial<Record<UpgradeId, UpgradeNode['unlocks']>> = {
  'gunner-01': [{ id: 'gunner', kind: 'tower', name: 'Rivet Gun' }],
  'gunner-05': [{ id: 'gunner-armor-piercer', kind: 'variant', name: 'Armor-Piercer Rivet Gun' }],
  'gunner-06': [{ id: 'heavyGun', kind: 'tower', name: 'Heavy Gun' }],
  'explosives-01': [{ id: 'cannon', kind: 'tower', name: 'Blast Cannon' }],
  'explosives-05': [{ id: 'cannon-cluster', kind: 'variant', name: 'Cluster Blast Cannon' }],
  'explosives-06': [{ id: 'rocket', kind: 'tower', name: 'Rocket Battery' }],
  'fire-01': [{ id: 'flamethrower', kind: 'tower', name: 'Flame Thrower' }],
  'fire-06': [{ id: 'flame-funeral-pyre', kind: 'variant', name: 'Funeral Pyre Flame Thrower' }],
  'cryo-01': [{ id: 'cryo', kind: 'tower', name: 'Cryo Projector' }],
  'cryo-05': [{ id: 'cryo-brittle', kind: 'variant', name: 'Brittle Cryo Projector' }],
  'cryo-06': [{ id: 'cryo-chain-freeze', kind: 'variant', name: 'Chain-Freeze Cryo Projector' }],
  'energy-01': [{ id: 'tesla', kind: 'tower', name: 'Tesla Coil' }],
  'energy-04': [{ id: 'tesla-stun', kind: 'variant', name: 'Stun Tesla Coil' }],
  'energy-05': [{ id: 'laser', kind: 'tower', name: 'Laser' }],
  'energy-06': [{ id: 'laser-piercing', kind: 'variant', name: 'Piercing Laser' }],
  'artillery-01': [{ id: 'mortar', kind: 'tower', name: 'Mortar' }],
  'artillery-05': [{ id: 'mortar-concussion', kind: 'variant', name: 'Concussion Mortar' }],
  'artillery-06': [{ id: 'mortar-cluster', kind: 'variant', name: 'Cluster Mortar' }],
  'command-04': [{ id: 'support', kind: 'tower', name: 'Support Beacon' }],
  'air-01': [{ id: 'strafe', kind: 'power', name: 'Aircraft Strafe' }],
  'strategic-01': [{ id: 'barrage', kind: 'power', name: 'Artillery Barrage' }],
  'strategic-03': [{ id: 'cryoBeam', kind: 'power', name: 'Cryo Beam' }],
  'strategic-05': [{ id: 'nuke', kind: 'power', name: 'Tactical Nuke' }],
  'fortification-01': [{ id: 'wall', kind: 'wall', name: 'Temporary Walls' }],
}

type DedicatedUnlock = {
  id: UpgradeId
  name: string
  effect: string
  unlock: NonNullable<UpgradeNode['unlocks']>[number]
  requirements: readonly UpgradeRequirement[]
}

const DEDICATED_UNLOCKS: readonly DedicatedUnlock[] = [
  { id: 'gunner-07', name: 'Rapid Feed', effect: 'Unlock the short-range rapid-fire Rivet Gun profile.', unlock: { id: 'gunner-rapid-feed', kind: 'variant', name: 'Rapid-Feed Rivet Gun' }, requirements: [{ id: 'gunner-03', rank: 'max' }] },
  { id: 'gunner-09', name: 'Anti-Armor Feed', effect: 'Unlock the narrow anti-armor Heavy Gun profile.', unlock: { id: 'heavy-anti-armor', kind: 'variant', name: 'Anti-Armor Heavy Gun' }, requirements: [{ id: 'gunner-11', rank: 'max' }] },
  { id: 'gunner-10', name: 'Siege Feed', effect: 'Unlock the wide suppression Heavy Gun profile.', unlock: { id: 'heavy-siege', kind: 'variant', name: 'Siege Heavy Gun' }, requirements: [{ id: 'gunner-12', rank: 'max' }] },
  { id: 'explosives-07', name: 'Hypervelocity', effect: 'Unlock the fast, tight-blast Cannon profile.', unlock: { id: 'cannon-hypervelocity', kind: 'variant', name: 'Hypervelocity Blast Cannon' }, requirements: [{ id: 'explosives-04', rank: 'max' }] },
  { id: 'explosives-08', name: 'Guided Rockets', effect: 'Unlock the precise anti-heavy Rocket profile.', unlock: { id: 'rocket-guided', kind: 'variant', name: 'Guided Rocket Battery' }, requirements: [{ id: 'explosives-11', rank: 'max' }] },
  { id: 'explosives-10', name: 'Rocket Salvo', effect: 'Unlock the fast crowd-control Rocket profile.', unlock: { id: 'rocket-salvo', kind: 'variant', name: 'Salvo Rocket Battery' }, requirements: [{ id: 'explosives-12', rank: 'max' }] },
  { id: 'fire-07', name: 'Napalm', effect: 'Unlock the long-burning Flame Thrower profile.', unlock: { id: 'flame-napalm', kind: 'variant', name: 'Napalm Flame Thrower' }, requirements: [{ id: 'fire-05', rank: 'max' }] },
  { id: 'energy-07', name: 'Tesla Overcharge', effect: 'Unlock the single-target burst Tesla profile.', unlock: { id: 'tesla-overcharge', kind: 'variant', name: 'Overcharge Tesla Coil' }, requirements: [{ id: 'energy-03', rank: 'max' }] },
  { id: 'energy-09', name: 'Orbital Laser', effect: 'Unlock the sustained orbital battlefield power.', unlock: { id: 'orbitalLaser', kind: 'power', name: 'Orbital Laser' }, requirements: [{ id: 'energy-05', rank: 'max' }] },
  { id: 'energy-10', name: 'Prism Laser', effect: 'Unlock the rapid short-range Laser profile.', unlock: { id: 'laser-prism', kind: 'variant', name: 'Prism Laser' }, requirements: [{ id: 'energy-13', rank: 'max' }] },
  { id: 'command-07', name: 'Forward Supply', effect: 'Unlock the +30 preparation supply doctrine.', unlock: { id: 'forwardSupply', kind: 'doctrine', name: 'Forward Supply' }, requirements: [{ id: 'command-01', rank: 'max' }] },
  { id: 'command-08', name: 'Lean Logistics', effect: 'Unlock the reduced setup-cost doctrine.', unlock: { id: 'leanLogistics', kind: 'doctrine', name: 'Lean Logistics' }, requirements: [{ id: 'command-02', rank: 'max' }] },
  { id: 'command-09', name: 'Rapid Response', effect: 'Unlock the faster command-cooldown doctrine.', unlock: { id: 'rapidResponse', kind: 'doctrine', name: 'Rapid Response' }, requirements: [{ id: 'command-03', rank: 'max' }] },
  { id: 'command-10', name: 'Emergency Repair', effect: 'Unlock the fortress repair battlefield power.', unlock: { id: 'repair', kind: 'power', name: 'Emergency Repair' }, requirements: [{ id: 'command-04', rank: 'max' }] },
  { id: 'command-11', name: 'Support Overclock', effect: 'Unlock the high-speed Support Beacon profile.', unlock: { id: 'support-overclock', kind: 'variant', name: 'Overclock Support Beacon' }, requirements: [{ id: 'command-05', rank: 'max' }] },
  { id: 'command-12', name: 'Fortress Network', effect: 'Unlock the wide defensive Support Beacon profile.', unlock: { id: 'support-fortress', kind: 'variant', name: 'Fortress Support Beacon' }, requirements: [{ id: 'command-06', rank: 'max' }] },
  { id: 'command-13', name: 'Bastion Reserve', effect: 'Unlock the fortress-and-wall reserve doctrine.', unlock: { id: 'bastionReserve', kind: 'doctrine', name: 'Bastion Reserve' }, requirements: [{ id: 'command-06', rank: 'max' }] },
]

function dedicatedUnlockNode(definition: DedicatedUnlock): UpgradeNode {
  return {
    id: definition.id, name: definition.name, effect: definition.effect, rankCosts: [0],
    kind: definition.unlock.kind, requirements: definition.requirements, unlocks: [definition.unlock],
    implemented: true, apply: (rules) => rules,
  }
}

const ADDITIONAL_STATS: readonly UpgradeNode[] = [
  { ...n('gunner-11', 'Heavy Caliber', '+10% Heavy Gun damage per rank.', [12, 20, 30], (t, r) => tower(t, 'heavyGun', { damage: t.towers.heavyGun.damage * power(1.1, r) })), requirements: [{ id: 'gunner-06', rank: 1 }] },
  { ...n('gunner-12', 'Feed Mechanism', '+8% Heavy Gun fire rate per rank.', [12, 20, 30], (t, r) => tower(t, 'heavyGun', { shotsPerSecond: t.towers.heavyGun.shotsPerSecond * power(1.08, r) })), requirements: [{ id: 'gunner-06', rank: 1 }] },
  { ...n('explosives-11', 'Guidance Package', '+8% Rocket range and projectile speed per rank.', [12, 20, 30], (t, r) => tower(t, 'rocket', { range: t.towers.rocket.range * power(1.08, r), projectileSpeed: (t.towers.rocket.projectileSpeed ?? 5.5) * power(1.08, r) })), requirements: [{ id: 'explosives-06', rank: 1 }] },
  { ...n('explosives-12', 'Salvo Loader', '+8% Rocket fire rate per rank.', [12, 20, 30], (t, r) => tower(t, 'rocket', { shotsPerSecond: t.towers.rocket.shotsPerSecond * power(1.08, r) })), requirements: [{ id: 'explosives-06', rank: 1 }] },
  { ...n('energy-12', 'Beam Focus', '+7% Laser damage and range per rank.', [14, 24, 36], (t, r) => tower(t, 'laser', { damage: t.towers.laser.damage * power(1.07, r), range: t.towers.laser.range * power(1.07, r) })), requirements: [{ id: 'energy-05', rank: 1 }] },
  { ...n('energy-13', 'Cycling Capacitor', '+8% Laser fire rate per rank.', [14, 24, 36], (t, r) => tower(t, 'laser', { shotsPerSecond: t.towers.laser.shotsPerSecond * power(1.08, r) })), requirements: [{ id: 'energy-05', rank: 1 }] },
]

for (const branch of BASE_UPGRADE_BRANCHES) {
  for (const node of branch.nodes) {
    const prerequisite = PREREQUISITES[node.id]
    node.unlocks = CORE_UNLOCKS[node.id]
    if (node.unlocks?.length === 1) node.kind = node.unlocks[0].kind
    node.requirements = prerequisite ? [{ id: prerequisite, rank: node.kind === 'variant' ? 'max' : 1 }] : undefined
  }
}

export const UPGRADE_BRANCHES: readonly UpgradeBranch[] = BASE_UPGRADE_BRANCHES.map((branch) => ({
  ...branch,
  nodes: [
    ...branch.nodes,
    ...ADDITIONAL_STATS.filter((node) => node.id.startsWith(`${branch.id}-`)),
    ...DEDICATED_UNLOCKS.filter((node) => node.id.startsWith(`${branch.id}-`)).map(dedicatedUnlockNode),
  ],
}))

export const ALL_UPGRADES = UPGRADE_BRANCHES.flatMap((branch) => branch.nodes)
export const STARTER_UPGRADES: UpgradeRanks = { 'gunner-01': 1 }

const BUILD_UNLOCKS: Record<BuildTool, UpgradeId> = {
  gunner: 'gunner-01', heavyGun: 'gunner-06', cannon: 'explosives-01', rocket: 'explosives-06',
  flamethrower: 'fire-01', cryo: 'cryo-01', tesla: 'energy-01', laser: 'energy-05',
  mortar: 'artillery-01', support: 'command-04', wall: 'fortification-01',
}

const POWER_UNLOCKS: Record<ActivePowerKind, UpgradeId> = {
  strafe: 'air-01', barrage: 'strategic-01', cryoBeam: 'strategic-03', nuke: 'strategic-05',
  orbitalLaser: 'energy-09', repair: 'command-10',
}

export function getRank(ranks: UpgradeRanks, id: UpgradeId): number { return ranks[id] ?? 0 }
export function ownsUpgrade(ranks: UpgradeRanks, id: UpgradeId): boolean { return getRank(ranks, id) > 0 }
export function isBuildToolUnlocked(ranks: UpgradeRanks, kind: BuildTool): boolean { return ownsUpgrade(ranks, BUILD_UNLOCKS[kind]) }
export function isPowerUnlocked(ranks: UpgradeRanks, kind: ActivePowerKind): boolean { return ownsUpgrade(ranks, POWER_UNLOCKS[kind]) }
export function getNextRankCost(ranks: UpgradeRanks, node: UpgradeNode): number | undefined { return node.rankCosts[getRank(ranks, node.id)] }
export function isMaxRank(ranks: UpgradeRanks, node: UpgradeNode): boolean { return getRank(ranks, node.id) >= node.rankCosts.length }

export function getPurchasePrerequisite(node: UpgradeNode): UpgradeId | undefined {
  return node.requirements?.[0]?.id
}

export function getPurchaseRequirements(node: UpgradeNode): readonly UpgradeRequirement[] {
  return node.requirements ?? []
}

export function isUpgradeRequirementMet(ranks: UpgradeRanks, requirement: UpgradeRequirement): boolean {
  const parent = ALL_UPGRADES.find((node) => node.id === requirement.id)
  if (!parent) return false
  return requirement.rank === 'max' ? isMaxRank(ranks, parent) : ownsUpgrade(ranks, parent.id)
}

export function areUpgradeRequirementsMet(ranks: UpgradeRanks, node: UpgradeNode): boolean {
  return getPurchaseRequirements(node).every((requirement) => isUpgradeRequirementMet(ranks, requirement))
}

export function canPurchaseUpgrade(ranks: UpgradeRanks, medals: number, node: UpgradeNode): boolean {
  const cost = getNextRankCost(ranks, node)
  return node.implemented && cost !== undefined && medals >= cost && areUpgradeRequirementsMet(ranks, node)
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

const LEGACY_SPLIT_UNLOCKS: Readonly<Record<string, readonly UpgradeId[]>> = {
  'gunner-03': ['gunner-07'], 'gunner-05': ['gunner-09'], 'gunner-06': ['gunner-10'],
  'explosives-04': ['explosives-07', 'explosives-08'], 'explosives-05': ['explosives-10'],
  'fire-05': ['fire-07'], 'energy-03': ['energy-07'], 'energy-05': ['energy-09', 'energy-10'],
  'command-01': ['command-07'], 'command-02': ['command-08'], 'command-03': ['command-09'],
  'command-04': ['command-10'], 'command-05': ['command-11'], 'command-06': ['command-12', 'command-13'],
}

/** Version-7 cards granted several unlocks at once. Preserve those owned choices after the cards split. */
export function migrateLegacyUpgradeUnlocks(ranks: UpgradeRanks): UpgradeRanks {
  const migrated = { ...ranks }
  for (const [sourceId, unlockIds] of Object.entries(LEGACY_SPLIT_UNLOCKS)) {
    if (!ownsUpgrade(ranks, sourceId as UpgradeId)) continue
    for (const unlockId of unlockIds) migrated[unlockId] = 1
  }
  return migrated
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
