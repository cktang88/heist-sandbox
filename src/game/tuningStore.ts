import { DEFAULT_TUNING, TOWER_KINDS } from './config'
import type { ActivePowerKind, DamageType, EnemyKind, GameTuning } from './types'

const TUNING_KEY = 'orcfall-command-tuning'
const TUNING_VERSION = 4
const ENEMY_KINDS: readonly EnemyKind[] = ['grunt', 'runner', 'brute', 'shieldbearer', 'armored', 'shaman', 'banner', 'sapper', 'berserker', 'ogre']
const DAMAGE_TYPES: readonly DamageType[] = ['ballistic', 'explosive', 'fire', 'cryo', 'electric', 'energy']
const POWER_KINDS: readonly ActivePowerKind[] = ['strafe', 'barrage', 'cryoBeam', 'nuke', 'orbitalLaser', 'repair']

export function loadTuning(): GameTuning {
  try {
    const stored = window.localStorage.getItem(TUNING_KEY)
    if (!stored) return cloneDefaults()
    const parsed: unknown = JSON.parse(stored)
    if (isRecord(parsed) && isTuning(parsed.tuning)) return withOptionalDefaults(parsed.tuning)
    if (isTuning(parsed)) return withOptionalDefaults(parsed)
    return migrateFlatTuning(parsed)
  } catch {
    return cloneDefaults()
  }
}

export function storeTuning(tuning: GameTuning): void {
  window.localStorage.setItem(TUNING_KEY, JSON.stringify({ version: TUNING_VERSION, tuning }))
}

function migrateFlatTuning(value: unknown): GameTuning {
  const next = cloneDefaults()
  if (!isRecord(value)) return next
  next.budget = positive(value.budget, next.budget)
  next.towers.gunner.damage = positive(value.gunnerDamage, next.towers.gunner.damage)
  next.towers.gunner.range = positive(value.gunnerRange, next.towers.gunner.range)
  next.towers.gunner.shotsPerSecond = positive(value.gunnerShotsPerSecond, next.towers.gunner.shotsPerSecond)
  next.enemies.grunt.health = positive(value.orcHealth, next.enemies.grunt.health)
  next.enemies.grunt.speed = positive(value.orcSpeed, next.enemies.grunt.speed)
  next.enemies.grunt.wallDamagePerSecond = positive(value.wallDamagePerSecond, next.enemies.grunt.wallDamagePerSecond)
  next.wall.health = positive(value.wallHealth, next.wall.health)
  return next
}

function isTuning(value: unknown): value is GameTuning {
  if (!isRecord(value) || !positiveNumber(value.budget) || !isRecord(value.towers) || !isRecord(value.enemies) || !isRecord(value.wall)) return false
  const towers = value.towers
  const enemies = value.enemies
  const wall = value.wall
  const powers = value.powers
  const powersValid = powers === undefined || isPowerTuning(powers)
  const towersValid = TOWER_KINDS.every((kind) => {
    const tower = towers[kind]
    return isRecord(tower) && positiveNumber(tower.cost) && positiveNumber(tower.range)
      && positiveNumber(tower.damage) && positiveNumber(tower.shotsPerSecond)
      && typeof tower.damageType === 'string' && DAMAGE_TYPES.includes(tower.damageType as DamageType)
      && isAttack(tower.attack)
  })
  const enemiesValid = ENEMY_KINDS.every((kind) => {
    const enemy = enemies[kind]
    return isRecord(enemy) && positiveNumber(enemy.health) && positiveNumber(enemy.speed)
      && positiveNumber(enemy.baseDamage) && positiveNumber(enemy.wallDamagePerSecond)
  })
  return towersValid && enemiesValid && powersValid && positiveNumber(wall.cost)
    && positiveNumber(wall.health) && positiveNumber(wall.collisionRadius)
}

function isPowerTuning(value: unknown): boolean {
  return isRecord(value) && POWER_KINDS.every((kind) => isPowerDefinition(value[kind]))
}

function isPowerDefinition(value: unknown): boolean {
  return isRecord(value) && positiveNumber(value.cooldown) && nonNegativeNumber(value.damage)
    && positiveNumber(value.size) && positiveNumber(value.warningTime) && positiveNumber(value.duration)
    && positiveNumber(value.impactCount) && (value.shape === 'lane' || value.shape === 'circle')
}

function isAttack(value: unknown): boolean {
  if (!isRecord(value) || typeof value.kind !== 'string') return false
  switch (value.kind) {
    case 'direct':
      return true
    case 'splash':
      return positiveNumber(value.radius)
    case 'flame':
      return positiveNumber(value.radius) && positiveNumber(value.burnDamagePerSecond) && positiveNumber(value.burnSeconds)
    case 'cryo':
      return positiveNumber(value.slowMultiplier) && positiveNumber(value.slowSeconds)
        && positiveNumber(value.freezePerHit) && positiveNumber(value.freezeThreshold) && positiveNumber(value.freezeSeconds)
    case 'chain':
      return positiveNumber(value.targets) && positiveNumber(value.jumpRadius)
    case 'support':
      return positiveNumber(value.radius) && positiveNumber(value.damageMultiplier) && positiveNumber(value.fireRateMultiplier)
    default:
      return false
  }
}

function cloneDefaults(): GameTuning {
  return structuredClone(DEFAULT_TUNING)
}

function withOptionalDefaults(tuning: GameTuning): GameTuning {
  const next = structuredClone(tuning)
  next.powers ??= structuredClone(DEFAULT_TUNING.powers)
  for (const kind of TOWER_KINDS) next.towers[kind].firingArcDegrees ??= DEFAULT_TUNING.towers[kind].firingArcDegrees
  next.towers.cannon.projectileSpeed ??= DEFAULT_TUNING.towers.cannon.projectileSpeed
  next.towers.mortar.projectileSpeed ??= DEFAULT_TUNING.towers.mortar.projectileSpeed
  next.towers.mortar.minRange ??= DEFAULT_TUNING.towers.mortar.minRange
  return next
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function positive(value: unknown, fallback: number): number {
  return positiveNumber(value) ? value : fallback
}

function positiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function nonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
