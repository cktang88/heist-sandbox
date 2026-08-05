import type { ActivePowerKind, BattleSnapshot, BuildTool, CombatPower, GameRules, GameTuning, PowerDefinition, TowerKind, WaveDefinition } from './types'
import { createEmptyDamageBySource } from './damageSources'
export { DEFAULT_MAP } from './maps'

export const BUILD = {
  minSpacing: 1.35,
  items: {
    gunner: { label: 'Rivet Gun', hint: 'Rapid • single target' },
    heavyGun: { label: 'Heavy Gun', hint: 'Spins up • narrow cone' },
    cannon: { label: 'Blast Cannon', hint: 'Slow • splash damage' },
    rocket: { label: 'Rocket Battery', hint: 'Long range • close dead zone' },
    flamethrower: { label: 'Flame Thrower', hint: 'Short range • burning' },
    cryo: { label: 'Cryo Projector', hint: 'Slows • freezes targets' },
    tesla: { label: 'Tesla Coil', hint: 'Chains through groups' },
    laser: { label: 'Laser Lance', hint: 'Ramps on one target' },
    mortar: { label: 'Field Mortar', hint: 'Huge splash • slow fire' },
    support: { label: 'Support Beacon', hint: 'Buffs nearby towers' },
    wall: { label: 'Field Wall', hint: 'Blocks the lane • breakable' },
  } satisfies Record<BuildTool, { label: string; hint: string }>,
}

export const TOWER_KINDS: readonly TowerKind[] = ['gunner', 'heavyGun', 'cannon', 'rocket', 'flamethrower', 'cryo', 'tesla', 'laser', 'mortar', 'support']

function defaultPowers(): Record<ActivePowerKind, PowerDefinition> {
  return {
    strafe: { cooldown: 18, damage: 46, size: 1.5, warningTime: 0.7, shape: 'lane', duration: 1.2, impactCount: 5 },
    barrage: { cooldown: 14, damage: 38, size: 2.2, warningTime: 0.75, shape: 'circle', duration: 1.2, impactCount: 3 },
    cryoBeam: { cooldown: 16, damage: 8, size: 1.35, warningTime: 0.5, shape: 'lane', duration: 1.2, impactCount: 1 },
    nuke: { cooldown: 55, damage: 500, size: 3.4, warningTime: 1.35, shape: 'circle', duration: 1.2, impactCount: 1 },
    orbitalLaser: { cooldown: 28, damage: 34, size: 1.05, warningTime: 0.45, shape: 'circle', duration: 4, impactCount: 1 },
    repair: { cooldown: 45, damage: 0, size: 0.7, warningTime: 0.1, shape: 'circle', duration: 0.8, impactCount: 1 },
  }
}

export const ACTIVE_POWER_OPTIONS: readonly { kind: ActivePowerKind; label: string }[] = [
  { kind: 'strafe', label: 'STRAFE' }, { kind: 'barrage', label: 'BARRAGE' },
  { kind: 'cryoBeam', label: 'CRYO' }, { kind: 'nuke', label: 'NUKE' },
  { kind: 'orbitalLaser', label: 'ORBITAL' }, { kind: 'repair', label: 'REPAIR' },
]

export function getCombatPowerLabel(power: CombatPower): string {
  return power === 'wall' ? 'TEMP WALL' : ACTIVE_POWER_OPTIONS.find((option) => option.kind === power)?.label ?? power
}

export const DEFAULT_TUNING: GameTuning = {
  budget: 360,
  powers: defaultPowers(),
  towers: {
    gunner: { cost: 45, range: 4.8, firingArcDegrees: 45, damage: 12, shotsPerSecond: 2.5, damageType: 'ballistic', attack: { kind: 'direct' } },
    heavyGun: { cost: 90, range: 4.4, firingArcDegrees: 40, damage: 9, shotsPerSecond: 5.2, damageType: 'ballistic', attack: { kind: 'direct' } },
    cannon: { cost: 85, range: 5.6, firingArcDegrees: 45, damage: 34, shotsPerSecond: 0.65, damageType: 'explosive', projectileSpeed: 7, attack: { kind: 'splash', radius: 1.35 } },
    rocket: { cost: 130, range: 7.2, firingArcDegrees: 35, minRange: 2.2, damage: 42, shotsPerSecond: 0.48, damageType: 'explosive', attack: { kind: 'splash', radius: 1.8 } },
    flamethrower: { cost: 70, range: 2.8, firingArcDegrees: 55, damage: 4, shotsPerSecond: 4, damageType: 'fire', attack: { kind: 'flame', radius: 1.15, burnDamagePerSecond: 7, burnSeconds: 2.4 } },
    cryo: { cost: 75, range: 4.2, firingArcDegrees: 50, damage: 3, shotsPerSecond: 1.7, damageType: 'cryo', attack: { kind: 'cryo', slowMultiplier: 0.55, slowSeconds: 1.8, freezePerHit: 1, freezeThreshold: 4, freezeSeconds: 1.4 } },
    tesla: { cost: 115, range: 4.4, firingArcDegrees: 60, damage: 18, shotsPerSecond: 1.2, damageType: 'electric', attack: { kind: 'chain', targets: 4, jumpRadius: 1.8 } },
    laser: { cost: 145, range: 6.1, firingArcDegrees: 30, damage: 60, shotsPerSecond: 0.8, damageType: 'energy', attack: { kind: 'direct' } },
    mortar: { cost: 125, range: 7.5, firingArcDegrees: 45, minRange: 2.4, damage: 58, shotsPerSecond: 0.38, damageType: 'explosive', projectileSpeed: 4, attack: { kind: 'splash', radius: 2.15 } },
    support: { cost: 95, range: 0.1, firingArcDegrees: 360, damage: 0.1, shotsPerSecond: 0.1, damageType: 'ballistic', attack: { kind: 'support', radius: 3.6, damageMultiplier: 1.18, fireRateMultiplier: 1.15 } },
  },
  enemies: {
    grunt: { health: 34, speed: 1.5, baseDamage: 4, wallDamagePerSecond: 28 },
    runner: { health: 20, speed: 2.6, baseDamage: 3, wallDamagePerSecond: 20 },
    brute: { health: 145, speed: 0.82, baseDamage: 12, wallDamagePerSecond: 62 },
    shieldbearer: { health: 72, speed: 1.12, baseDamage: 6, wallDamagePerSecond: 34, ballisticReduction: 0.55 },
    armored: { health: 115, speed: 0.95, baseDamage: 8, wallDamagePerSecond: 40, ballisticReduction: 0.68 },
    shaman: { health: 58, speed: 1.05, baseDamage: 5, wallDamagePerSecond: 24, speedAura: 1.2 },
    banner: { health: 68, speed: 1.1, baseDamage: 6, wallDamagePerSecond: 30, wallDamageAura: 1.3 },
    sapper: { health: 48, speed: 1.35, baseDamage: 5, wallDamagePerSecond: 95 },
    berserker: { health: 88, speed: 1.25, baseDamage: 9, wallDamagePerSecond: 46 },
    ogre: { health: 520, speed: 0.55, baseDamage: 28, wallDamagePerSecond: 130 },
  },
  wall: { cost: 20, health: 105, collisionRadius: 0.8 },
}

export const WAVES: readonly WaveDefinition[] = [
  { groups: [{ enemy: 'grunt', count: 14, interval: 0.58 }], intermission: 1.4 },
  { groups: [{ enemy: 'grunt', count: 12, interval: 0.44 }, { enemy: 'runner', count: 10, interval: 0.3 }], intermission: 1.4 },
  { groups: [{ enemy: 'shieldbearer', count: 8, interval: 0.58 }, { enemy: 'armored', count: 6, interval: 0.62 }, { enemy: 'grunt', count: 14, interval: 0.34 }], intermission: 1.4 },
  { groups: [{ enemy: 'runner', count: 18, interval: 0.22 }, { enemy: 'shaman', count: 4, interval: 0.75 }, { enemy: 'sapper', count: 6, interval: 0.48 }, { enemy: 'brute', count: 5, interval: 0.8 }], intermission: 1.4 },
  { groups: [
    { enemy: 'grunt', count: 20, interval: 0.25, startDelay: 0 },
    { enemy: 'banner', count: 4, interval: 0.72, startDelay: 1.2 },
    { enemy: 'berserker', count: 10, interval: 0.4, startDelay: 2.2 },
    { enemy: 'shieldbearer', count: 8, interval: 0.42, startDelay: 3.2 },
    { enemy: 'ogre', count: 2, interval: 1.2, startDelay: 5 },
  ], intermission: 1.4 },
]

export function countEnemies(waves: readonly WaveDefinition[]): number {
  return waves.reduce((total, wave) => total + wave.groups.reduce((sum, group) => sum + group.count, 0), 0)
}

export function getBuildCost(kind: BuildTool, tuning: GameTuning): number {
  return kind === 'wall' ? tuning.wall.cost : tuning.towers[kind].cost
}

export function isTowerKind(kind: BuildTool): kind is TowerKind {
  return kind !== 'wall'
}

export function isOffensiveTowerKind(kind: TowerKind, tuning: GameTuning): boolean {
  return tuning.towers[kind].attack.kind !== 'support'
}

export const TOTAL_ENEMIES = countEnemies(WAVES)

const EMPTY_DAMAGE: Record<TowerKind, number> = { gunner: 0, heavyGun: 0, cannon: 0, rocket: 0, flamethrower: 0, cryo: 0, tesla: 0, laser: 0, mortar: 0, support: 0 }

export const INITIAL_SNAPSHOT: BattleSnapshot = {
  baseHealth: 100,
  fortressShield: 0,
  leaks: 0,
  enemiesAlive: 0,
  enemiesDefeated: 0,
  wavesCleared: 0,
  elapsedSeconds: 0,
  wave: 0,
  totalWaves: WAVES.length,
  spawned: 0,
  totalEnemies: TOTAL_ENEMIES,
  strafeCooldown: 0,
  powerCooldowns: { strafe: 0, barrage: 0, cryoBeam: 0, nuke: 0, orbitalLaser: 0, repair: 0 },
  damageByTower: { ...EMPTY_DAMAGE },
  damageBySource: createEmptyDamageBySource(),
  secondaryObjectiveHealth: null, secondaryObjectiveMaxHealth: null, secondaryObjectiveBonusMedals: 0,
  bossWave: false, waveRewardMultiplier: 1,
}

export const STRAFE = { cooldown: 18, damage: 46, laneWidth: 1.5, warningTime: 0.7 }

export const POWERS: Record<ActivePowerKind, PowerDefinition> = defaultPowers()

export function createBaseGameRules(tuning: GameTuning): GameRules {
  return {
    tuning: structuredClone(tuning),
    powers: structuredClone(tuning.powers),
    powerCharges: {
      strafe: 1,
      barrage: null,
      cryoBeam: null,
      nuke: 1,
      orbitalLaser: null,
      repair: 1,
    },
    wall: {
      charges: 2,
      length: 1,
      lifetimeSeconds: 15,
      contactDamagePerSecond: 0,
      breakExplosionDamage: 0,
      rechargeSeconds: 6,
    },
    setup: {
      towerSlots: 3,
      powerSlots: 3,
      preparationRefundMultiplier: 1,
      fortressShield: 0,
    },
    behaviors: {
      armorPiercingRivets: false,
      cannonClusterShells: false,
      burningDeathSpread: false,
      brittleFrozenEnemies: false,
      chainFreeze: false,
      teslaStun: false,
      piercingLaser: false,
      mortarStun: false,
      mortarClusterShells: false,
      strafeArmorBreak: false,
      cryoFrozenGround: false,
      nukeFallout: false,
      wallSpikes: false,
      wallBreakExplosion: false,
    },
  }
}
