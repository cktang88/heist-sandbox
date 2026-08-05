import { INITIAL_SNAPSHOT, isTowerKind } from './config'
import { isNavigationPositionWalkable, sampleNavigation, updateNavigationCache, type NavigationCache, type NavigationField, type NavigationWall } from './navigation'
import { distance, type PathInfo } from './path'
import { duePowerImpacts, powerDamageAt, powerKnockback } from './powerEffects'
import { isPointInPowerLane } from './powerTargeting'
import { getRunTotals, getWave } from './runs'
import { EnemySpatialIndex, type SpatialIndexTelemetry } from './spatialIndex'
import { deriveWallRotation, distanceToWall } from './wall'
import { calculateDamage, createEmptyDamageBySource, isAttackInFront, recordDamageCredit, type DamageCredit } from './damageSources'
import { applyTowerVariant, getTowerVariant } from './towerVariants'
import { getTowerArcDegrees, isPointWithinTowerArc } from './towerFacing'
import { towerMuzzlePoint } from './towerMuzzle'
import { addKnockback, knockbackResistance, stepKnockback } from './knockback'
import type { ActivePowerKind, BattleSnapshot, DamageSource, DamageType, EnemyKind, EnemyMultipliers, GameRules, GameTuning, MapDefinition, Placement, Point, RunRules, TowerKind, TowerStats, WaveDefinition } from './types'
import type { CombatEventTotals } from './audio'

export { calculateDamage, isAttackInFront } from './damageSources'

export type EnemyStatus = {
  burnRemaining: number
  burnDamagePerSecond: number
  slowRemaining: number
  slowMultiplier: number
  freezeCharge: number
  freezeRemaining: number
  stunRemaining: number
  brittleRemaining: number
  armorBreakRemaining: number
  armorBreakAmount: number
  /** Set only by the Funeral Pyre variant; optional keeps old saves/test fixtures compatible. */
  spreadsBurnOnDeath?: boolean
}

export type Enemy = Point & { id: number; kind: EnemyKind; pathIndex: number; progress: number; previousX?: number; previousZ?: number; facingX?: number; facingZ?: number; knockbackX?: number; knockbackZ?: number; health: number; maxHealth?: number; healthMultiplier: number; speedMultiplier: number; damageMultiplier: number; status: EnemyStatus }
export type RuntimeWall = NavigationWall & { health: number; life: number }
export type Tracer = { id: number; tower: TowerKind; from: Point; fromY: number; to: Point; toY: number; life: number; duration: number; arcHeight: number }
export type CombatVisual = Point & { id: number; kind: 'death' | 'impact' | 'wallBreak'; life: number; duration: number; enemyKind?: EnemyKind; rotation?: number }
export const MAX_CORPSE_VISUALS = 192
export const MAX_TRANSIENT_VISUALS = 128
export const MAX_COMBAT_VISUALS = MAX_CORPSE_VISUALS + MAX_TRANSIENT_VISUALS
export type TowerEngagement = { targetId: number; seconds: number }
export type PowerRun = {
  id: number
  kind: ActivePowerKind
  point: Point
  lineEnd?: Point
  warning: number
  life: number
  fired: boolean
  activeElapsed: number
  impactsFired: number
}
type GroupSpawnRuntime = { spawned: number; nextSpawnAt: number }

export const SIMULATION_STEP = 1 / 30
export type SimulationTelemetry = SpatialIndexTelemetry & {
  simulationSteps: number
  lastStepMs: number
  averageStepMs: number
  navigationRebuilds: number
}

export type CombatEffect =
  | {
    id: number
    kind: 'impact'
    delay: number
    point: Point
    radius: number
    damage: number
    damageType: DamageType
    tower?: TowerKind
    source?: DamageSource
    stunSeconds?: number
    burnSeconds?: number
    burnDamagePerSecond?: number
    cluster?: boolean
    knockbackForce?: number
  }
  | {
    id: number
    kind: 'zone'
    delay: number
    point: Point
    lineEnd?: Point
    shape: 'circle' | 'lane'
    size: number
    life: number
    tickEvery: number
    tickTimer: number
    damagePerSecond: number
    damageType: DamageType
    source?: DamageSource
    slowMultiplier?: number
  }

export type SimulationState = {
  accumulator: number
  elapsedSeconds: number
  baseHealth: number
  fortressShield: number
  leaks: number
  fortressHitFlash: number
  fortressHitWasShielded: boolean
  defeated: number
  damageByTower: Record<TowerKind, number>
  damageBySource: Record<DamageSource, number>
  enemies: Enemy[]
  nextEnemyId: number
  nextTracerId: number
  reportTimer: number
  spawnTimer: number
  spawned: number
  spawnedInGroup: number
  towerCooldowns: Map<number, number>
  towerEngagements: Map<number, TowerEngagement>
  towerLastShotAt: Map<number, number>
  tracers: Tracer[]
  powerCooldowns: Record<ActivePowerKind, number>
  powers: PowerRun[]
  effects: CombatEffect[]
  nextEffectId: number
  wallById: Map<number, RuntimeWall>
  waveIndex: number
  groupIndex: number
  scheduledWaveIndex: number
  scheduledWaveElapsed: number
  scheduledGroups: GroupSpawnRuntime[]
  removedWallIds: Set<number>
  navigationCache: NavigationCache | null
  navigationDirty: boolean
  enemyIndex: EnemySpatialIndex<Enemy>
  telemetry: SimulationTelemetry
  eventTotals: CombatEventTotals
  visuals: CombatVisual[]
  nextVisualId: number
  secondaryObjectiveHealth: number
  secondaryObjectiveMaxHealth: number
  secondaryObjectiveHitFlash: number
  secondaryObjectiveBonusMedals: number
}

type SimulationContext = { map: MapDefinition; pathInfos: PathInfo[]; rules: GameRules; towers: Placement[]; run: RunRules }

export function createSimulation(placements: Placement[], rules: GameRules, baseHealth = INITIAL_SNAPSHOT.baseHealth, map?: MapDefinition): SimulationState {
  return {
    accumulator: 0, elapsedSeconds: 0, baseHealth, fortressShield: rules.setup.fortressShield,
    leaks: 0, fortressHitFlash: 0, fortressHitWasShielded: false, defeated: 0,
    damageByTower: { gunner: 0, heavyGun: 0, cannon: 0, rocket: 0, flamethrower: 0, cryo: 0, tesla: 0, laser: 0, mortar: 0, support: 0 },
    damageBySource: createEmptyDamageBySource(),
    enemies: [], nextEnemyId: 1, nextTracerId: 1, reportTimer: 0, spawnTimer: 0.5,
    spawned: 0, spawnedInGroup: 0, towerCooldowns: new Map(), towerEngagements: new Map(), towerLastShotAt: new Map(), tracers: [],
    powerCooldowns: { strafe: 0, barrage: 0, cryoBeam: 0, nuke: 0, orbitalLaser: 0, repair: 0 }, powers: [],
    effects: [], nextEffectId: 1,
    wallById: new Map(placements.filter(isWall).map((wall) => [wall.id, createWall(wall, rules, map)])),
    waveIndex: 0, groupIndex: 0, scheduledWaveIndex: -1, scheduledWaveElapsed: 0, scheduledGroups: [], removedWallIds: new Set(),
    navigationCache: null, navigationDirty: true,
    enemyIndex: new EnemySpatialIndex<Enemy>([]),
    telemetry: { entities: 0, cells: 0, queries: 0, candidatesChecked: 0, simulationSteps: 0, lastStepMs: 0, averageStepMs: 0, navigationRebuilds: 0 },
    eventTotals: { shots: 0, impacts: 0, leaks: 0, wallBreaks: 0 }, visuals: [], nextVisualId: 1,
    secondaryObjectiveHealth: map?.secondaryObjective?.health ?? 0,
    secondaryObjectiveMaxHealth: map?.secondaryObjective?.health ?? 0,
    secondaryObjectiveHitFlash: 0,
    secondaryObjectiveBonusMedals: map?.secondaryObjective?.bonusMedals ?? 0,
  }
}

export function syncWalls(state: SimulationState, placements: Placement[], rules: GameRules, map?: MapDefinition): void {
  for (const wall of placements.filter(isWall)) {
    if (state.wallById.has(wall.id)) continue
    state.wallById.set(wall.id, createWall(wall, rules, map))
    state.navigationDirty = true
  }
}

export function addStrafe(state: SimulationState, id: number, z: number, rules: GameRules): boolean {
  return addPower(state, id, 'strafe', { x: 0, z }, rules)
}

export function addPower(state: SimulationState, id: number, kind: ActivePowerKind, point: Point, rules: GameRules, lineEnd?: Point): boolean {
  if (state.powerCooldowns[kind] > 0) return false
  const definition = rules.powers[kind]
  state.powers.push({
    id, kind, point, lineEnd, warning: definition.warningTime, life: definition.duration,
    fired: false, activeElapsed: 0, impactsFired: 0,
  })
  state.powerCooldowns[kind] = definition.cooldown
  return true
}

/** Moves only an already-fired guided power; cooldown and activation remain untouched. */
export function guideActivePower(state: Pick<SimulationState, 'powers'>, kind: 'orbitalLaser', point: Point): boolean {
  const active = [...state.powers].reverse().find((power) => power.kind === kind && power.fired && power.life > 0)
  if (!active) return false
  active.point = { ...point }
  return true
}

export function stepSimulation(state: SimulationState, context: SimulationContext, delta: number): void {
  const startedAt = currentTime()
  state.fortressHitFlash = Math.max(0, state.fortressHitFlash - delta)
  state.secondaryObjectiveHitFlash = Math.max(0, state.secondaryObjectiveHitFlash - delta)
  for (const enemy of state.enemies) {
    enemy.previousX = enemy.x
    enemy.previousZ = enemy.z
  }
  state.elapsedSeconds += delta
  spawnEnemies(state, context, delta)
  state.enemyIndex.rebuild(state.enemies, {
    minX: -context.map.width / 2 - 1, maxX: context.map.width / 2 + 1,
    minZ: -context.map.depth / 2 - 1, maxZ: context.map.depth / 2 + 1,
  })
  updateStatuses(state, context.rules, delta)
  updatePowers(state, context.rules, delta, state.enemyIndex)
  updateEffects(state, context.rules, delta, state.enemyIndex)
  moveEnemies(state, context, delta, state.enemyIndex)
  fireTowers(state, context.towers, context.rules, delta, state.enemyIndex)
  removeExpiredEntities(state, delta, context.rules)
  const stepMs = currentTime() - startedAt
  const spatial = state.enemyIndex.telemetry()
  const simulationSteps = state.telemetry.simulationSteps + 1
  state.telemetry = {
    ...spatial,
    simulationSteps,
    lastStepMs: stepMs,
    averageStepMs: state.telemetry.averageStepMs + (stepMs - state.telemetry.averageStepMs) / simulationSteps,
    navigationRebuilds: state.navigationCache?.rebuilds ?? 0,
  }
}

export function findTowerTarget(tower: Placement, enemies: Enemy[], range: number, minRange = 0, index?: EnemySpatialIndex<Enemy>, firingArcDegrees = 360): Enemy | undefined {
  const spatial = index ?? new EnemySpatialIndex(enemies)
  const eligible = (enemy: Enemy) => enemy.health > 0 && distance(tower, enemy) >= minRange && isPointWithinTowerArc(tower, enemy, firingArcDegrees)
  if ((tower.targetingRule ?? 'closest') === 'closest') return spatial.nearest(tower, range, eligible)
  const candidates = spatial.withinRadius(tower, range, eligible)
  switch (tower.targetingRule) {
    case 'first': return bestTarget(candidates, (enemy) => enemy.progress, true)
    case 'strongest': return bestTarget(candidates, (enemy) => enemy.health, true)
    case 'weakest': return bestTarget(candidates, (enemy) => enemy.health, false)
    case 'densest': return bestTarget(candidates, (enemy) => spatial.neighbors(enemy, 1.5, (candidate) => candidate.health > 0).length, true)
    default: return candidates[0]
  }
}

function bestTarget(candidates: readonly Enemy[], score: (enemy: Enemy) => number, highest: boolean): Enemy | undefined {
  let best: Enemy | undefined
  let bestScore = highest ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY
  for (const candidate of candidates) {
    const candidateScore = score(candidate)
    if (best && (highest ? candidateScore <= bestScore : candidateScore >= bestScore)) continue
    best = candidate
    bestScore = candidateScore
  }
  return best
}

export function getSimulationTelemetry(state: SimulationState): SimulationTelemetry { return { ...state.telemetry } }

export function interpolatedEnemyPosition(enemy: Enemy, alpha: number): Point {
  const amount = Math.max(0, Math.min(1, alpha))
  const previousX = enemy.previousX ?? enemy.x
  const previousZ = enemy.previousZ ?? enemy.z
  return { x: previousX + (enemy.x - previousX) * amount, z: previousZ + (enemy.z - previousZ) * amount }
}

export function toSnapshot(state: SimulationState, run: RunRules): BattleSnapshot {
  const totals = getRunTotals(run)
  const wavesCleared = isRunWon(state, run) && totals.waves !== null ? totals.waves : state.waveIndex
  return {
    baseHealth: Math.ceil(state.baseHealth), fortressShield: Math.ceil(state.fortressShield), leaks: state.leaks,
    enemiesAlive: state.enemies.length, enemiesDefeated: state.defeated,
    wavesCleared, elapsedSeconds: state.elapsedSeconds,
    wave: totals.waves === null ? state.waveIndex + 1 : Math.min(totals.waves, state.waveIndex + 1), totalWaves: totals.waves,
    spawned: state.spawned, totalEnemies: totals.enemies,
    strafeCooldown: Math.ceil(state.powerCooldowns.strafe * 10) / 10,
    powerCooldowns: Object.fromEntries(Object.entries(state.powerCooldowns).map(([kind, cooldown]) => [kind, Math.ceil(cooldown * 10) / 10])) as Record<ActivePowerKind, number>,
    damageByTower: { ...state.damageByTower },
    damageBySource: { ...state.damageBySource },
    secondaryObjectiveHealth: state.secondaryObjectiveMaxHealth > 0 ? Math.ceil(state.secondaryObjectiveHealth) : null,
    secondaryObjectiveMaxHealth: state.secondaryObjectiveMaxHealth > 0 ? state.secondaryObjectiveMaxHealth : null,
    secondaryObjectiveBonusMedals: state.secondaryObjectiveHealth > 0 ? state.secondaryObjectiveBonusMedals : 0,
    bossWave: getWave(run, state.waveIndex)?.boss ?? false,
    waveRewardMultiplier: getWave(run, state.waveIndex)?.rewardMultiplier ?? 1,
  }
}

export function isRunWon(state: SimulationState, run: RunRules): boolean {
  const totals = getRunTotals(run)
  return totals.enemies !== null && state.spawned >= totals.enemies && state.enemies.length === 0
}

function createWall(wall: Placement, rules: GameRules, map?: MapDefinition): RuntimeWall {
  return {
    ...wall,
    rotation: wall.rotation ?? (map ? deriveWallRotation(map, wall) : 0),
    length: rules.wall.length,
    radius: rules.tuning.wall.collisionRadius,
    health: rules.tuning.wall.health,
    life: wall.temporary ? rules.wall.lifetimeSeconds : Number.POSITIVE_INFINITY,
  }
}

function isWall(placement: Placement): boolean { return placement.kind === 'wall' }

function updatePowers(state: SimulationState, rules: GameRules, delta: number, index: EnemySpatialIndex<Enemy>): void {
  for (const kind of Object.keys(state.powerCooldowns) as ActivePowerKind[]) state.powerCooldowns[kind] = Math.max(0, state.powerCooldowns[kind] - delta)
  for (const power of state.powers) {
    power.warning -= delta
    if (!power.fired && power.warning <= 0) {
      power.fired = true
      const definition = rules.powers[power.kind]
      if (power.kind === 'repair') state.baseHealth = Math.min(100, state.baseHealth + 35)
      if (power.kind !== 'repair' && power.kind !== 'orbitalLaser' && power.kind !== 'barrage' && power.kind !== 'strafe') {
        const candidates = definition.shape === 'circle'
          ? index.withinRadius(power.point, definition.size, isAlive)
          : state.enemies
        for (const enemy of candidates) {
          const hit = definition.shape === 'lane'
            ? isPointInPowerLane(enemy, power.point, power.lineEnd, definition.size / 2)
            : distance(enemy, power.point) <= definition.size
          if (!hit || enemy.health <= 0) continue
          damageEnemy(state, enemy, powerDamageAt(power.kind, definition.damage, enemy, power.point, definition.size), power.kind === 'cryoBeam' ? 'cryo' : 'explosive', rules, { source: power.kind })
          if (power.kind === 'nuke' && enemy.health > 0) applyPowerKnockback(enemy, power, definition.size)
          if (power.kind === 'cryoBeam' && enemy.health > 0) {
            enemy.status.freezeRemaining = Math.max(enemy.status.freezeRemaining, 3)
            if (rules.behaviors.brittleFrozenEnemies) enemy.status.brittleRemaining = Math.max(enemy.status.brittleRemaining, 3)
            enemy.status.slowRemaining = Math.max(enemy.status.slowRemaining, 4)
            enemy.status.slowMultiplier = Math.min(enemy.status.slowMultiplier, 0.35)
          }
        }
      }
      if (power.kind === 'cryoBeam' && rules.behaviors.cryoFrozenGround) {
        queueZone(state, {
          point: power.point, lineEnd: power.lineEnd, shape: 'lane', size: definition.size, life: 6,
          tickEvery: 0.5, damagePerSecond: 4, damageType: 'cryo', slowMultiplier: 0.55,
          source: 'cryoBeam',
        })
      }
      if (power.kind === 'nuke' && rules.behaviors.nukeFallout) {
        queueZone(state, {
          point: power.point, shape: 'circle', size: definition.size, life: 8,
          tickEvery: 0.5, damagePerSecond: 12, damageType: 'explosive',
          source: 'nuke',
        })
      }
      if (power.kind !== 'repair' && power.kind !== 'barrage' && power.kind !== 'strafe') recordImpactVisual(state, power.point)
    }
    if (power.fired) {
      const definition = rules.powers[power.kind]
      power.activeElapsed = Math.min(definition.duration, power.activeElapsed + delta)
      if (power.kind === 'barrage') {
        const due = duePowerImpacts(power.activeElapsed, definition.duration, definition.impactCount)
        while (power.impactsFired < due) {
          const impact = barrageImpactPoint(power.point, definition.size, power.impactsFired)
          for (const enemy of index.withinRadius(impact, barrageImpactRadius(definition.size), isAlive)) {
            damageEnemy(state, enemy, definition.damage, 'explosive', rules, { source: 'barrage' })
          }
          recordImpactVisual(state, impact)
          power.impactsFired += 1
        }
      }
      if (power.kind === 'strafe') {
        const due = duePowerImpacts(power.activeElapsed, definition.duration, definition.impactCount)
        while (power.impactsFired < due) {
          const damage = definition.damage / definition.impactCount
          for (const enemy of state.enemies) {
            if (enemy.health <= 0 || !isPointInPowerLane(enemy, power.point, power.lineEnd, definition.size / 2)) continue
            damageEnemy(state, enemy, damage, 'explosive', rules, { source: 'strafe' })
            if (enemy.health <= 0) continue
            applyPowerKnockback(enemy, power, definition.size)
            if (rules.behaviors.strafeArmorBreak) applyArmorBreak(enemy)
          }
          recordImpactVisual(state, { x: power.point.x, z: power.point.z })
          power.impactsFired += 1
        }
      }
      if (power.kind === 'orbitalLaser') {
        for (const enemy of index.withinRadius(power.point, definition.size, isAlive)) {
          damageEnemy(state, enemy, definition.damage * delta, 'energy', rules, { source: 'orbitalLaser' })
        }
      }
      power.life -= delta
    }
  }
  state.powers = state.powers.filter((power) => !power.fired || power.life > 0)
}

function applyPowerKnockback(enemy: Enemy, power: PowerRun, radius: number): void {
  const displacement = powerKnockback(power.kind, enemy, power.point, radius, power.lineEnd)
  enemy.knockbackX = (enemy.knockbackX ?? 0) + displacement.x
  enemy.knockbackZ = (enemy.knockbackZ ?? 0) + displacement.z
}

export function barrageImpactPoint(center: Point, targetRadius: number, index: number): Point {
  if (index === 0) return { ...center }
  const angle = index * 2.399963229728653
  const radius = targetRadius * (0.35 + (index % 3) * 0.18)
  return { x: center.x + Math.cos(angle) * radius, z: center.z + Math.sin(angle) * radius }
}

export function barrageImpactRadius(targetRadius: number): number {
  return targetRadius * 0.45
}

type ImpactEffect = Extract<CombatEffect, { kind: 'impact' }>
type ZoneEffect = Extract<CombatEffect, { kind: 'zone' }>
type NewImpact = Omit<ImpactEffect, 'id' | 'kind' | 'delay'> & { delay?: number }
type NewZone = Omit<ZoneEffect, 'id' | 'kind' | 'delay' | 'tickTimer'> & { delay?: number }

function queueImpact(state: SimulationState, effect: NewImpact): void {
  state.effects.push({ id: state.nextEffectId++, kind: 'impact', delay: effect.delay ?? 0, ...effect })
}

function queueZone(state: SimulationState, effect: NewZone): void {
  state.effects.push({
    id: state.nextEffectId++, kind: 'zone', delay: effect.delay ?? 0,
    tickTimer: effect.tickEvery, ...effect,
  })
}

function updateEffects(state: SimulationState, rules: GameRules, delta: number, index: EnemySpatialIndex<Enemy>): void {
  const current = state.effects
  state.effects = []
  for (const effect of current) {
    effect.delay -= delta
    if (effect.delay > 0) {
      state.effects.push(effect)
      continue
    }
    if (effect.kind === 'impact') {
      resolveImpact(state, effect, rules, index)
      continue
    }
    effect.life -= delta
    effect.tickTimer -= delta
    while (effect.tickTimer <= 0 && effect.life >= 0) {
      const candidates = effect.shape === 'circle' ? index.withinRadius(effect.point, effect.size, isAlive) : state.enemies
      for (const enemy of candidates) {
        if (!effectContains(effect, enemy)) continue
        damageEnemy(state, enemy, effect.damagePerSecond * effect.tickEvery, effect.damageType, rules, { source: effect.source })
        if (effect.slowMultiplier !== undefined && enemy.health > 0) {
          enemy.status.slowRemaining = Math.max(enemy.status.slowRemaining, effect.tickEvery + 0.1)
          enemy.status.slowMultiplier = Math.min(enemy.status.slowMultiplier, effect.slowMultiplier)
        }
      }
      effect.tickTimer += effect.tickEvery
    }
    if (effect.life > 0) state.effects.push(effect)
  }
}

function resolveImpact(state: SimulationState, effect: ImpactEffect, rules: GameRules, index: EnemySpatialIndex<Enemy>): void {
  state.eventTotals.impacts += 1
  addCombatVisual(state, 'impact', effect.point, 0.22)
  for (const enemy of index.withinRadius(effect.point, effect.radius, isAlive)) {
    damageEnemy(state, enemy, effect.damage, effect.damageType, rules, { tower: effect.tower, source: effect.source })
    if (enemy.health <= 0) continue
    if (effect.stunSeconds) enemy.status.stunRemaining = Math.max(enemy.status.stunRemaining, effect.stunSeconds)
    if (effect.burnSeconds) {
      enemy.status.burnRemaining = Math.max(enemy.status.burnRemaining, effect.burnSeconds)
      enemy.status.burnDamagePerSecond = Math.max(enemy.status.burnDamagePerSecond, effect.burnDamagePerSecond ?? 0)
    }
    if (effect.knockbackForce) addKnockback(enemy, effect.point, effect.knockbackForce, knockbackResistance(enemy.kind))
  }
  if (!effect.cluster) return
  for (let index = 0; index < 3; index += 1) {
    queueImpact(state, {
      delay: 0.12 + index * 0.04,
      point: clusterImpactPoint(effect.point, effect.radius, index),
      radius: effect.radius * 0.7,
      damage: effect.damage * 0.42,
      damageType: effect.damageType,
      tower: effect.tower,
      source: effect.source,
    })
  }
}

function effectContains(effect: ZoneEffect, enemy: Enemy): boolean {
  if (enemy.health <= 0) return false
  return effect.shape === 'lane'
    ? isPointInPowerLane(enemy, effect.point, effect.lineEnd, effect.size / 2)
    : distance(enemy, effect.point) <= effect.size
}

export function clusterImpactPoint(center: Point, radius: number, index: number): Point {
  const angle = index * Math.PI * 2 / 3 + Math.PI / 6
  return { x: center.x + Math.cos(angle) * radius * 0.62, z: center.z + Math.sin(angle) * radius * 0.62 }
}

function updateStatuses(state: SimulationState, rules: GameRules, delta: number): void {
  for (const enemy of state.enemies) {
    const status = enemy.status
    if (status.burnRemaining > 0) {
      damageEnemy(state, enemy, status.burnDamagePerSecond * delta, 'fire', rules, { tower: 'flamethrower' })
      status.burnRemaining -= delta
    }
    status.slowRemaining = Math.max(0, status.slowRemaining - delta)
    status.freezeRemaining = Math.max(0, status.freezeRemaining - delta)
    status.stunRemaining = Math.max(0, status.stunRemaining - delta)
    status.brittleRemaining = Math.max(0, status.brittleRemaining - delta)
    status.armorBreakRemaining = Math.max(0, status.armorBreakRemaining - delta)
    const maxHealth = rules.tuning.enemies[enemy.kind].health * enemy.healthMultiplier
    if (enemy.health > maxHealth) enemy.health = maxHealth
  }
}

function moveEnemies(state: SimulationState, context: SimulationContext, delta: number, index: EnemySpatialIndex<Enemy>): void {
  const liveWalls = [...state.wallById.values()].filter((wall) => wall.health > 0)
  const hasShaman = state.enemies.some((enemy) => enemy.health > 0 && enemy.kind === 'shaman')
  const hasBanner = state.enemies.some((enemy) => enemy.health > 0 && enemy.kind === 'banner')
  if (state.navigationDirty || !state.navigationCache) {
    state.navigationCache = updateNavigationCache(state.navigationCache, context.map, liveWalls)
    state.navigationDirty = false
  }
  const navigation = state.navigationCache.field
  const separationScratch = { x: 0, z: 0 }
  for (const enemy of state.enemies) {
    if (enemy.health <= 0) continue
    stepKnockback(enemy, navigation, delta)
    if (enemy.status.freezeRemaining > 0 || enemy.status.stunRemaining > 0) continue
    const stats = context.rules.tuning.enemies[enemy.kind]
    const route = sampleNavigation(navigation, enemy)
    const sapperTarget = enemy.kind === 'sapper' ? findSapperWallTarget(enemy, liveWalls) : undefined
    const blockingWall = route.blockingWallId === undefined ? undefined : state.wallById.get(route.blockingWallId)
    const contactWall = blockingWall && distanceToWall(enemy, blockingWall, blockingWall.length) <= blockingWall.radius + 0.2
      ? blockingWall
      : liveWalls.find((wall) => distanceToWall(enemy, wall, wall.length) <= wall.radius)
    const objective = context.map.secondaryObjective
    if (objective && state.secondaryObjectiveHealth > 0 && distance(enemy, objective) <= 0.72) {
      state.secondaryObjectiveHealth = Math.max(0, state.secondaryObjectiveHealth - stats.wallDamagePerSecond * enemy.damageMultiplier * delta)
      state.secondaryObjectiveHitFlash = 0.18
      continue
    }
    if (contactWall) {
      const bannerAura = hasBanner && hasNearbyAura(index, enemy, 'banner')
        ? context.rules.tuning.enemies.banner.wallDamageAura ?? 1 : 1
      contactWall.health -= stats.wallDamagePerSecond * enemy.damageMultiplier * bannerAura * delta
      if (context.rules.behaviors.wallSpikes && context.rules.wall.contactDamagePerSecond > 0) {
        damageEnemy(state, enemy, context.rules.wall.contactDamagePerSecond * delta, 'ballistic', context.rules, { source: 'wallSpikes' })
      }
      continue
    }
    const slow = enemy.status.slowRemaining > 0 ? enemy.status.slowMultiplier : 1
    const shamanAura = hasShaman && hasNearbyAura(index, enemy, 'shaman')
      ? context.rules.tuning.enemies.shaman.speedAura ?? 1 : 1
    const rage = enemy.kind === 'berserker' && enemy.health < stats.health * enemy.healthMultiplier / 2 ? 1.5 : 1
    const path = context.map.paths[enemy.pathIndex]
    const pathInfo = context.pathInfos[enemy.pathIndex]
    const separation = separationDirection(index, enemy, separationScratch)
    const desiredDirection = sapperTarget
      ? normalizedDirection(sapperTarget.x - enemy.x, sapperTarget.z - enemy.z)
      : route.direction
    const direction = normalizedDirection(desiredDirection.x + separation.x * 0.32, desiredDirection.z + separation.z * 0.32)
    const travel = stats.speed * enemy.speedMultiplier * slow * shamanAura * rage * delta
    const step = route.atGoal ? Math.min(travel, distance(enemy, route.next)) : travel
    const previousX = enemy.x
    const previousZ = enemy.z
    moveEnemyWithinNavigation(enemy, navigation, direction.x * step, direction.z * step)
    const moved = normalizedDirection(enemy.x - previousX, enemy.z - previousZ)
    if (moved.x !== 0 || moved.z !== 0) {
      enemy.facingX = moved.x
      enemy.facingZ = moved.z
    }
    enemy.progress = Math.max(enemy.progress, progressAlongPath(enemy, path, pathInfo))
    const fortress = path[path.length - 1]
    if (route.atGoal && distance(enemy, fortress) <= 0.24) {
      enemy.health = 0
      state.leaks += 1
      state.eventTotals.leaks += 1
      state.fortressHitFlash = 0.32
      state.fortressHitWasShielded = state.fortressShield > 0
      const bannerAura = hasBanner && hasNearbyAura(index, enemy, 'banner')
        ? context.rules.tuning.enemies.banner.wallDamageAura ?? 1 : 1
      applyFortressDamage(state, stats.baseDamage * enemy.damageMultiplier * bannerAura)
    }
  }
}

/** Crowd separation may slide along a road edge, but never moves an orc into grass or a solid cell. */
function moveEnemyWithinNavigation(enemy: Enemy, field: NavigationField, stepX: number, stepZ: number): void {
  const nextX = enemy.x + stepX
  const nextZ = enemy.z + stepZ
  if (isNavigationPositionWalkable(field, nextX, nextZ)) {
    enemy.x = nextX
    enemy.z = nextZ
    return
  }
  if (isNavigationPositionWalkable(field, nextX, enemy.z)) enemy.x = nextX
  if (isNavigationPositionWalkable(field, enemy.x, nextZ)) enemy.z = nextZ
}

export function applyFortressDamage(state: Pick<SimulationState, 'baseHealth' | 'fortressShield'>, damage: number): void {
  const absorbed = Math.min(state.fortressShield, Math.max(0, damage))
  state.fortressShield -= absorbed
  state.baseHealth = Math.max(0, state.baseHealth - Math.max(0, damage - absorbed))
}

const CROWD_RADIUS = 0.58

function separationDirection(index: EnemySpatialIndex<Enemy>, enemy: Enemy, out: Point): Point {
  return index.separationVector(enemy, CROWD_RADIUS, isAlive, 12, enemy.id, out)
}

function normalizedDirection(x: number, z: number): Point {
  const length = Math.hypot(x, z)
  return length > 0.0001 ? { x: x / length, z: z / length } : { x: 0, z: 0 }
}

function progressAlongPath(point: Point, path: readonly Point[], info: PathInfo): number {
  let closestDistance = Number.POSITIVE_INFINITY
  let closestProgress = 0
  let completedLength = 0
  for (let index = 0; index < info.lengths.length; index += 1) {
    const start = path[index]
    const end = path[index + 1]
    const dx = end.x - start.x
    const dz = end.z - start.z
    const lengthSquared = dx * dx + dz * dz
    const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared))
    const projected = { x: start.x + dx * amount, z: start.z + dz * amount }
    const currentDistance = distance(point, projected)
    if (currentDistance < closestDistance) {
      closestDistance = currentDistance
      closestProgress = info.totalLength === 0 ? 1 : (completedLength + info.lengths[index] * amount) / info.totalLength
    }
    completedLength += info.lengths[index]
  }
  return closestProgress
}

const AURA_RADIUS = 2.5
const SAPPER_SEEK_RADIUS = 4.5

type AuraKind = 'shaman' | 'banner'
function hasNearbyAura(index: EnemySpatialIndex<Enemy>, enemy: Enemy, kind: AuraKind): boolean {
  return index.someWithinRadius(enemy, AURA_RADIUS, (source) => source.health > 0 && source.kind === kind)
}

/** Sappers leave the marching line to attack a nearby live wall. */
export function findSapperWallTarget(enemy: Point, walls: readonly RuntimeWall[]): RuntimeWall | undefined {
  let closest: RuntimeWall | undefined
  let closestDistance = SAPPER_SEEK_RADIUS
  for (const wall of walls) {
    if (wall.health <= 0) continue
    const currentDistance = distanceToWall(enemy, wall, wall.length)
    if (currentDistance >= closestDistance) continue
    closest = wall
    closestDistance = currentDistance
  }
  return closest
}

function fireTowers(state: SimulationState, towers: Placement[], rules: GameRules, delta: number, index: EnemySpatialIndex<Enemy>): void {
  for (const tower of towers) {
    if (!isTowerKind(tower.kind)) continue
    const stats = getTowerStatsForPlacement(tower, towers, rules.tuning)
    if (stats.attack.kind === 'support') continue
    const cooldown = (state.towerCooldowns.get(tower.id) ?? 0) - delta
    if (cooldown > 0) { state.towerCooldowns.set(tower.id, cooldown); continue }
    const target = findTowerTarget(tower, state.enemies, stats.range, stats.minRange ?? 0, index, getTowerArcDegrees(stats))
    if (!target) {
      state.towerEngagements.delete(tower.id)
      continue
    }
    const engagement = nextTowerEngagement(state.towerEngagements.get(tower.id), target.id, 1 / stats.shotsPerSecond)
    state.towerEngagements.set(tower.id, engagement)
    const bonuses = towerEngagementBonuses(tower.kind, engagement.seconds)
    resolveAttack(state, tower.kind, tower, target, stats, rules, index, bonuses.damage)
    if (stats.attack.kind !== 'splash' || !stats.projectileSpeed) addCombatVisual(state, 'impact', target, 0.16)
    state.eventTotals.shots += 1
    const duration = stats.projectileSpeed ? Math.max(0.12, distance(tower, target) / stats.projectileSpeed) : 0.14
    const muzzle = towerMuzzlePoint({ ...tower, kind: tower.kind }, target)
    state.tracers.push({
      id: state.nextTracerId++, tower: tower.kind, from: muzzle, fromY: muzzle.y, to: { x: target.x, z: target.z }, toY: 0.38,
      life: duration, duration, arcHeight: projectileArcHeight(tower.kind, distance(tower, target)),
    })
    state.towerLastShotAt.set(tower.id, state.elapsedSeconds)
    state.towerCooldowns.set(tower.id, 1 / (stats.shotsPerSecond * bonuses.fireRate))
  }
}

export function nextTowerEngagement(current: TowerEngagement | undefined, targetId: number, shotSeconds: number): TowerEngagement {
  return current?.targetId === targetId
    ? { targetId, seconds: current.seconds + Math.max(0, shotSeconds) }
    : { targetId, seconds: 0 }
}

export function towerEngagementBonuses(kind: TowerKind, seconds: number): { damage: number; fireRate: number } {
  const focus = Math.max(0, seconds)
  if (kind === 'heavyGun') return { damage: 1, fireRate: 1 + Math.min(0.8, focus / 1.5 * 0.8) }
  if (kind === 'laser') return { damage: 1 + Math.min(1.2, focus / 2 * 1.2), fireRate: 1 }
  return { damage: 1, fireRate: 1 }
}

function resolveAttack(state: SimulationState, towerKind: TowerKind, tower: Placement, target: Enemy, stats: TowerStats, rules: GameRules, index: EnemySpatialIndex<Enemy>, damageMultiplier = 1): void {
  switch (stats.attack.kind) {
    case 'direct': {
      const variant = getTowerVariant(towerKind, tower.variantId)
      const targets = towerKind === 'heavyGun'
        ? enemiesInCone(index, tower, target, stats.range, variant?.id === 'heavy-siege' ? 0.95 : variant?.id === 'heavy-anti-armor' ? 0.28 : 0.5)
        : towerKind === 'laser' && (rules.behaviors.piercingLaser || variant?.id === 'laser-piercing')
          ? enemiesBehindTarget(index, tower, target, stats.range, 4)
          : [target]
      targets.forEach((enemy) => damageEnemy(state, enemy, stats.damage * damageMultiplier, stats.damageType, rules, {
        tower: towerKind,
        armorPiercing: (towerKind === 'gunner' && (rules.behaviors.armorPiercingRivets || variant?.id === 'gunner-armor-piercer'))
          || (towerKind === 'heavyGun' && variant?.id === 'heavy-anti-armor'),
        attackOrigin: tower,
      }))
      const directForce = stats.knockbackForce ?? 0
      if (directForce > 0) targets.forEach((enemy) => {
        if (enemy.health > 0) addKnockback(enemy, tower, variantKnockback(tower, directForce), knockbackResistance(enemy.kind))
      })
      break
    }
    case 'splash': {
      if (stats.projectileSpeed) {
        queueImpact(state, {
          delay: distance(tower, target) / stats.projectileSpeed,
          point: { x: target.x, z: target.z },
          radius: stats.attack.radius,
          damage: stats.damage,
          damageType: stats.damageType,
          tower: towerKind,
          knockbackForce: variantKnockback(tower, stats.knockbackForce ?? 0),
          stunSeconds: towerKind === 'mortar' && (rules.behaviors.mortarStun || tower.variantId === 'mortar-concussion') ? 0.65 : undefined,
          cluster: towerKind === 'cannon' ? rules.behaviors.cannonClusterShells || tower.variantId === 'cannon-cluster'
            : towerKind === 'mortar' ? rules.behaviors.mortarClusterShells || tower.variantId === 'mortar-cluster' : false,
        })
        break
      }
      const targets = index.withinRadius(target, stats.attack.radius, isAlive)
      for (const enemy of targets) {
        damageEnemy(state, enemy, stats.damage, stats.damageType, rules, { tower: towerKind })
        if (enemy.health > 0 && stats.knockbackForce) addKnockback(enemy, target, variantKnockback(tower, stats.knockbackForce), knockbackResistance(enemy.kind))
        if (towerKind === 'mortar' && rules.behaviors.mortarStun && enemy.health > 0) {
          enemy.status.stunRemaining = Math.max(enemy.status.stunRemaining, 0.65)
        }
      }
      break
    }
    case 'flame':
      for (const enemy of enemiesInCone(index, tower, target, stats.range, stats.attack.radius)) {
        enemy.status.burnRemaining = Math.max(enemy.status.burnRemaining, stats.attack.burnSeconds)
        enemy.status.burnDamagePerSecond = Math.max(enemy.status.burnDamagePerSecond, stats.attack.burnDamagePerSecond)
        if (tower.variantId === 'flame-funeral-pyre') enemy.status.spreadsBurnOnDeath = true
        damageEnemy(state, enemy, stats.damage, stats.damageType, rules, { tower: towerKind })
      }
      break
    case 'cryo':
      damageEnemy(state, target, stats.damage, stats.damageType, rules, { tower: towerKind })
      target.status.slowRemaining = stats.attack.slowSeconds
      target.status.slowMultiplier = stats.attack.slowMultiplier
      target.status.freezeCharge += stats.attack.freezePerHit
      if (target.status.freezeCharge >= stats.attack.freezeThreshold) {
        target.status.freezeCharge = 0
        applyFreeze(target, stats.attack.freezeSeconds, rules)
        if (tower.variantId === 'cryo-brittle') target.status.brittleRemaining = Math.max(target.status.brittleRemaining, stats.attack.freezeSeconds)
        if (rules.behaviors.chainFreeze || tower.variantId === 'cryo-chain-freeze') {
          const chained = index.nearest(target, 1.8, (enemy) => enemy !== target && enemy.health > 0)
          if (chained) applyFreeze(chained, stats.attack.freezeSeconds, rules)
        }
      }
      break
    case 'chain': {
      const chainAttack = stats.attack
      const chained = [target]
      while (chained.length < chainAttack.targets) {
        const last = chained[chained.length - 1]
        const next = index.nearest(last, chainAttack.jumpRadius, (enemy) => enemy.health > 0 && !chained.includes(enemy))
        if (!next) break
        chained.push(next)
      }
      chained.forEach((enemy) => {
        damageEnemy(state, enemy, stats.damage, stats.damageType, rules, { tower: towerKind })
        if ((rules.behaviors.teslaStun || tower.variantId === 'tesla-stun') && enemy.health > 0) {
          enemy.status.stunRemaining = Math.max(enemy.status.stunRemaining, tower.variantId === 'tesla-stun' ? 0.55 : 0.35)
        }
      })
      break
    }
    case 'support':
      break
  }
}

type DamageOptions = DamageCredit & { armorPiercing?: boolean; attackOrigin?: Point }

function damageEnemy(state: SimulationState, enemy: Enemy, damage: number, damageType: DamageType, rules: GameRules, options: DamageOptions = {}): void {
  if (enemy.health <= 0) return
  const wasBurning = enemy.status.burnRemaining > 0
  const healthBefore = enemy.health
  const applied = calculateDamage(enemy, damage, damageType, rules, options.armorPiercing ?? false, options.attackOrigin)
  enemy.health -= applied
  recordDamageCredit(state.damageByTower, state.damageBySource, options, applied, healthBefore)
  if (enemy.health <= 0) {
    state.defeated += 1
    addCombatVisual(state, 'death', enemy, 12, { enemyKind: enemy.kind, rotation: Math.atan2(enemy.facingZ ?? 0, enemy.facingX ?? 1) })
    if (wasBurning && (rules.behaviors.burningDeathSpread || enemy.status.spreadsBurnOnDeath)) {
      queueImpact(state, {
        point: { x: enemy.x, z: enemy.z }, radius: 1.4, damage: 0, damageType: 'fire',
        burnSeconds: 2, burnDamagePerSecond: Math.max(4, enemy.status.burnDamagePerSecond * 0.6),
        source: 'flamethrower',
      })
    }
  }
}

function applyFreeze(enemy: Enemy, duration: number, rules: GameRules): void {
  enemy.status.freezeRemaining = Math.max(enemy.status.freezeRemaining, duration)
  if (rules.behaviors.brittleFrozenEnemies) enemy.status.brittleRemaining = Math.max(enemy.status.brittleRemaining, duration)
}

function applyArmorBreak(enemy: Enemy): void {
  enemy.status.armorBreakRemaining = Math.max(enemy.status.armorBreakRemaining, 4)
  enemy.status.armorBreakAmount = Math.max(enemy.status.armorBreakAmount, 0.35)
}

function enemiesBehindTarget(index: EnemySpatialIndex<Enemy>, tower: Point, target: Enemy, range: number, cap: number): Enemy[] {
  const targetDistance = distance(tower, target)
  if (targetDistance <= 0) return [target]
  const directionX = (target.x - tower.x) / targetDistance
  const directionZ = (target.z - tower.z) / targetDistance
  return index.withinRadius(tower, range, isAlive)
    .filter((enemy) => {
      if (enemy.health <= 0) return false
      const offsetX = enemy.x - tower.x
      const offsetZ = enemy.z - tower.z
      const forward = offsetX * directionX + offsetZ * directionZ
      const lateral = Math.abs(offsetX * directionZ - offsetZ * directionX)
      return forward >= targetDistance - 0.01 && forward <= range && lateral <= 0.32
    })
    .sort((left, right) => distance(tower, left) - distance(tower, right))
    .slice(0, cap)
}

function enemiesInCone(index: EnemySpatialIndex<Enemy>, origin: Point, target: Point, range: number, endRadius: number): Enemy[] {
  const targetDistance = distance(origin, target)
  if (targetDistance === 0 || range <= 0) return []
  const directionX = (target.x - origin.x) / targetDistance
  const directionZ = (target.z - origin.z) / targetDistance
  return index.withinRadius(origin, range, isAlive).filter((enemy) => {
    if (enemy.health <= 0) return false
    const offsetX = enemy.x - origin.x
    const offsetZ = enemy.z - origin.z
    const forward = offsetX * directionX + offsetZ * directionZ
    const lateral = Math.abs(offsetX * directionZ - offsetZ * directionX)
    return forward >= 0 && forward <= range && lateral <= endRadius * (forward / range)
  })
}

export function getTowerStatsForPlacement(towerPlacement: Placement, towers: Placement[], tuning: GameTuning): TowerStats {
  if (!isTowerKind(towerPlacement.kind)) return tuning.towers.gunner
  const base = applyTowerVariant(towerPlacement.kind, towerPlacement.variantId, tuning.towers[towerPlacement.kind])
  let damageMultiplier = 1
  let fireRateMultiplier = 1
  for (const placement of towers) {
    if (placement.kind !== 'support') continue
    const support = applyTowerVariant('support', placement.variantId, tuning.towers.support).attack
    if (support.kind !== 'support' || distance(placement, towerPlacement) > support.radius) continue
    damageMultiplier *= support.damageMultiplier
    fireRateMultiplier *= support.fireRateMultiplier
  }
  return { ...base, damage: base.damage * damageMultiplier, shotsPerSecond: base.shotsPerSecond * fireRateMultiplier }
}

function removeExpiredEntities(state: SimulationState, delta: number, rules: GameRules): void {
  state.tracers.forEach((tracer) => { tracer.life -= delta })
  state.tracers = state.tracers.filter((tracer) => tracer.life > 0)
  compactAliveEnemies(state.enemies)
  state.visuals.forEach((visual) => { visual.life -= delta })
  state.visuals = state.visuals.filter((visual) => visual.life > 0)
  for (const [id, wall] of state.wallById) {
    if (Number.isFinite(wall.life)) wall.life -= delta
    if (wall.health <= 0 || wall.life <= 0) {
      if (wall.health <= 0) {
        state.eventTotals.wallBreaks += 1
        addCombatVisual(state, 'wallBreak', wall, 0.55)
      }
      if (wall.health <= 0 && rules.behaviors.wallBreakExplosion) {
        queueImpact(state, {
          point: wall, radius: 2, damage: rules.wall.breakExplosionDamage, damageType: 'explosive',
          source: 'wallExplosion',
        })
      }
      state.wallById.delete(id)
      state.removedWallIds.add(id)
      state.navigationDirty = true
    }
  }
}

function compactAliveEnemies(enemies: Enemy[]): void {
  let write = 0
  for (let read = 0; read < enemies.length; read += 1) {
    const enemy = enemies[read]
    if (enemy.health <= 0) continue
    enemies[write] = enemy
    write += 1
  }
  enemies.length = write
}

export function addCombatVisual(state: Pick<SimulationState, 'visuals' | 'nextVisualId'>, kind: CombatVisual['kind'], point: Point, life: number, metadata: Pick<CombatVisual, 'enemyKind' | 'rotation'> = {}): void {
  state.visuals.push({ id: state.nextVisualId++, kind, x: point.x, z: point.z, life, duration: life, ...metadata })
  const isCorpse = kind === 'death'
  const limit = isCorpse ? MAX_CORPSE_VISUALS : MAX_TRANSIENT_VISUALS
  let matching = 0
  for (const visual of state.visuals) if ((visual.kind === 'death') === isCorpse) matching += 1
  if (matching <= limit) return
  const oldest = state.visuals.findIndex((visual) => (visual.kind === 'death') === isCorpse)
  if (oldest >= 0) state.visuals.splice(oldest, 1)
}

export function projectileArcHeight(kind: TowerKind, distanceToTarget: number): number {
  if (kind === 'mortar') return Math.min(3.8, 1.4 + distanceToTarget * 0.3)
  if (kind === 'rocket') return Math.min(1.6, 0.35 + distanceToTarget * 0.12)
  if (kind === 'cannon') return Math.min(0.8, 0.15 + distanceToTarget * 0.07)
  return 0
}

function variantKnockback(tower: Placement, base: number): number {
  if (tower.variantId === 'mortar-concussion') return base * 1.65
  if (tower.variantId === 'cannon-cluster' || tower.variantId === 'mortar-cluster') return base * 0.72
  if (tower.variantId === 'rocket-guided') return base * 1.2
  return base
}

function recordImpactVisual(state: SimulationState, point: Point): void {
  state.eventTotals.impacts += 1
  addCombatVisual(state, 'impact', point, 0.22)
}

function spawnEnemies(state: SimulationState, context: SimulationContext, delta: number): void {
  const wave = getWave(context.run, state.waveIndex)
  if (!wave) return
  if (wave.groups.some((group) => group.startDelay !== undefined)) {
    spawnScheduledWave(state, context, wave, delta)
    return
  }
  const group = wave.groups[state.groupIndex]
  state.spawnTimer -= delta
  if (state.spawnedInGroup < group.count && state.spawnTimer <= 0) {
    const rankSize = Math.min(spawnRankSize(context.map), group.count - state.spawnedInGroup)
    for (let index = 0; index < rankSize; index += 1) {
      spawnEnemy(state, context.map, context.rules, group.enemy, group.lane, wave.multipliers)
    }
    state.spawned += rankSize
    state.spawnedInGroup += rankSize
    state.spawnTimer += group.interval
  }
  if (state.spawnedInGroup >= group.count && state.enemies.length === 0) {
    if (state.groupIndex < wave.groups.length - 1) state.groupIndex += 1
    else { advanceWave(state, wave.intermission); return }
    state.spawnedInGroup = 0
    state.spawnTimer = wave.intermission
  }
}

function spawnScheduledWave(state: SimulationState, context: SimulationContext, wave: WaveDefinition, delta: number): void {
  if (state.scheduledWaveIndex !== state.waveIndex) {
    state.scheduledWaveIndex = state.waveIndex
    state.scheduledWaveElapsed = 0
    state.scheduledGroups = wave.groups.map((group) => ({ spawned: 0, nextSpawnAt: Math.max(0, group.startDelay ?? 0) }))
  }

  state.spawnTimer -= delta
  if (state.spawnTimer > 0) return
  state.scheduledWaveElapsed += delta

  wave.groups.forEach((group, index) => {
    const runtime = state.scheduledGroups[index]
    while (runtime.spawned < group.count && runtime.nextSpawnAt <= state.scheduledWaveElapsed) {
      const rankSize = Math.min(spawnRankSize(context.map), group.count - runtime.spawned)
      for (let member = 0; member < rankSize; member += 1) {
        spawnEnemy(state, context.map, context.rules, group.enemy, group.lane, wave.multipliers)
      }
      runtime.spawned += rankSize
      state.spawned += rankSize
      runtime.nextSpawnAt += group.interval
    }
  })

  const allSpawned = state.scheduledGroups.every((runtime, index) => runtime.spawned >= wave.groups[index].count)
  if (allSpawned && state.enemies.length === 0) advanceWave(state, wave.intermission)
}

function advanceWave(state: SimulationState, intermission: number): void {
  state.waveIndex += 1
  state.groupIndex = 0
  state.spawnedInGroup = 0
  state.spawnTimer = intermission
  state.scheduledWaveIndex = -1
  state.scheduledWaveElapsed = 0
  state.scheduledGroups = []
}

function spawnEnemy(
  state: SimulationState,
  map: MapDefinition,
  rules: GameRules,
  kind: EnemyKind,
  lane?: number,
  multipliers?: Partial<EnemyMultipliers>,
): void {
  const laneCount = map.paths.length
  const pathIndex = lane === undefined
    ? (state.nextEnemyId - 1) % laneCount
    : ((Math.trunc(lane) % laneCount) + laneCount) % laneCount
  const start = map.paths[pathIndex][0]
  const next = map.paths[pathIndex][1] ?? start
  const facing = normalizedDirection(next.x - start.x, next.z - start.z)
  const healthMultiplier = multipliers?.health ?? 1
  const speedMultiplier = multipliers?.speed ?? 1
  const damageMultiplier = multipliers?.damage ?? 1
  const maxHealth = rules.tuning.enemies[kind].health * healthMultiplier
  const spawn = spawnPointForEnemy(map, pathIndex, state.nextEnemyId - 1)
  state.enemies.push({
    id: state.nextEnemyId++, kind, pathIndex, progress: 0,
    health: maxHealth, maxHealth,
    healthMultiplier, speedMultiplier, damageMultiplier,
    x: spawn.x, z: spawn.z, previousX: spawn.x, previousZ: spawn.z,
    facingX: facing.x, facingZ: facing.z, status: emptyStatus(),
  })
}

const ORC_FRONT_SPACING = 0.52

/** Number of orcs emitted together: road width for corridors, entrance width for open fields. */
export function spawnRankSize(map: Pick<MapDefinition, 'depth' | 'pathWidth' | 'paths' | 'navigationMode'>): number {
  if (map.navigationMode === 'open') {
    const frontSlots = Math.max(1, Math.floor((map.depth - 1) / ORC_FRONT_SPACING))
    return Math.max(1, Math.floor(frontSlots / Math.max(1, map.paths.length)))
  }
  return Math.max(1, Math.floor((map.pathWidth - 0.1) / ORC_FRONT_SPACING))
}

/** Gives every rank visible width instead of stacking every orc on the route's first point. */
export function spawnPointForEnemy(map: Pick<MapDefinition, 'depth' | 'pathWidth' | 'paths' | 'navigationMode'>, pathIndex: number, ordinal: number): Point {
  const path = map.paths[pathIndex]
  const start = path[0]
  if (map.navigationMode === 'open') {
    const slots = spawnRankSize(map) * Math.max(1, map.paths.length)
    const usableDepth = Math.max(ORC_FRONT_SPACING, map.depth - 1)
    const slot = ((ordinal % slots) + slots) % slots
    return { x: start.x, z: -usableDepth / 2 + (slot + 0.5) * usableDepth / slots }
  }
  const next = path[1] ?? start
  const forward = normalizedDirection(next.x - start.x, next.z - start.z)
  const width = spawnRankSize(map)
  const slot = ((ordinal % width) + width) % width
  const offset = (slot - (width - 1) / 2) * ORC_FRONT_SPACING
  return { x: start.x - forward.z * offset, z: start.z + forward.x * offset }
}

/** Adds diagnostic enemies without altering authored wave totals. The caller marks the run unranked. */
export function spawnStressEnemies(state: SimulationState, map: MapDefinition, rules: GameRules, count: number, kind: EnemyKind = 'grunt'): number {
  const amount = Math.max(0, Math.floor(count))
  for (let index = 0; index < amount; index += 1) spawnEnemy(state, map, rules, kind)
  return amount
}

function emptyStatus(): EnemyStatus {
  return {
    burnRemaining: 0, burnDamagePerSecond: 0, slowRemaining: 0, slowMultiplier: 1,
    freezeCharge: 0, freezeRemaining: 0, stunRemaining: 0, brittleRemaining: 0,
    armorBreakRemaining: 0, armorBreakAmount: 0,
  }
}

function isAlive(enemy: Enemy): boolean { return enemy.health > 0 }

function currentTime(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}
