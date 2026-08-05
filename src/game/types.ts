export type GamePhase = 'briefing' | 'setup' | 'battle' | 'victory' | 'defeat'
export type TowerKind = 'gunner' | 'heavyGun' | 'cannon' | 'rocket' | 'flamethrower' | 'cryo' | 'tesla' | 'laser' | 'mortar' | 'support'
export type TowerVariantId =
  | 'gunner-armor-piercer' | 'gunner-rapid-feed'
  | 'heavy-anti-armor' | 'heavy-siege'
  | 'cannon-hypervelocity' | 'cannon-cluster'
  | 'rocket-guided' | 'rocket-salvo'
  | 'flame-napalm' | 'flame-funeral-pyre'
  | 'cryo-brittle' | 'cryo-chain-freeze'
  | 'tesla-stun' | 'tesla-overcharge'
  | 'laser-piercing' | 'laser-prism'
  | 'mortar-concussion' | 'mortar-cluster'
  | 'support-overclock' | 'support-fortress'
export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'shieldbearer' | 'armored' | 'shaman' | 'banner' | 'sapper' | 'berserker' | 'ogre'
export type BuildTool = TowerKind | 'wall'
export type TargetingRule = 'first' | 'closest' | 'strongest' | 'weakest' | 'densest'
export type ActivePowerKind = 'strafe' | 'barrage' | 'cryoBeam' | 'nuke' | 'orbitalLaser' | 'repair'
export type CombatPower = 'wall' | ActivePowerKind
export type DamageType = 'ballistic' | 'explosive' | 'fire' | 'cryo' | 'electric' | 'energy'
export type DamageSource = TowerKind | ActivePowerKind | 'wallSpikes' | 'wallExplosion'

export type PowerDefinition = {
  cooldown: number
  damage: number
  size: number
  warningTime: number
  shape: 'lane' | 'circle'
  duration: number
  impactCount: number
}

export type TowerAttack =
  | { kind: 'direct' }
  | { kind: 'splash'; radius: number }
  | { kind: 'flame'; radius: number; burnDamagePerSecond: number; burnSeconds: number }
  | { kind: 'cryo'; slowMultiplier: number; slowSeconds: number; freezePerHit: number; freezeThreshold: number; freezeSeconds: number }
  | { kind: 'chain'; targets: number; jumpRadius: number }
  | { kind: 'support'; radius: number; damageMultiplier: number; fireRateMultiplier: number }

export type TowerStats = {
  cost: number
  range: number
  /** Horizontal targeting sector. 360 keeps non-weapon support effects omnidirectional. */
  firingArcDegrees?: number
  damage: number
  shotsPerSecond: number
  damageType: DamageType
  attack: TowerAttack
  projectileSpeed?: number
  minRange?: number
  /** Initial push speed applied by a hit. Zero keeps utility weapons steady. */
  knockbackForce?: number
}

export type EnemyStats = {
  health: number
  speed: number
  baseDamage: number
  wallDamagePerSecond: number
  ballisticReduction?: number
  speedAura?: number
  wallDamageAura?: number
}

export type SpawnGroup = {
  enemy: EnemyKind
  count: number
  interval: number
  /** Seconds after the wave begins. Setting this on any group enables overlapping spawns. */
  startDelay?: number
  /** Zero-based path index. Omit to distribute enemies across every lane. */
  lane?: number
}
export type EnemyMultipliers = { health: number; speed: number; damage: number }
export type WaveDefinition = {
  groups: readonly SpawnGroup[]
  intermission: number
  multipliers?: Partial<EnemyMultipliers>
  rewardMultiplier?: number
  boss?: boolean
}
export type GameMode = 'campaign' | 'endless' | 'challenge' | 'sandbox'
export type DifficultyTier = 'cadet' | 'standard' | 'veteran'
export type ChallengeModifiers = {
  noPowers?: boolean
  allowedTools?: readonly BuildTool[]
  allowedPowers?: readonly CombatPower[]
  allowEmptyDeployment?: boolean
  towerSlots?: 1 | 2 | 3 | 4
  powerSlots?: 0 | 1 | 2 | 3
  forcedSpeed?: 1 | 2
  baseHealth?: number
}
export type RunRules =
  | { mode: 'campaign'; missionId: string; waves: readonly WaveDefinition[]; difficulty?: DifficultyTier }
  | { mode: 'endless'; difficulty?: DifficultyTier }
  | { mode: 'challenge'; challengeId: string; waves: readonly WaveDefinition[]; modifiers: ChallengeModifiers }
  | { mode: 'sandbox'; waves: readonly WaveDefinition[] }

export type Point = {
  x: number
  z: number
}

export type MapObstacle = Point & { radius: number }
/** Orcs cannot cross either kind. Towers may be placed on platforms, while blockers reject all placement. */
export type MapSolidPolygon = { points: Point[]; kind?: 'blocker' | 'platform' }
export type MapBuildZone = Point & { radius: number }
export type MapDecorationKind = 'tree' | 'shrub' | 'crater'
export type MapDecoration = Point & { kind: MapDecorationKind }
export type MapSecondaryObjective = Point & { kind: 'supplyCache'; health: number; bonusMedals: number }

export type MapDefinition = {
  id: string
  name: string
  width: number
  depth: number
  pathWidth: number
  paths: Point[][]
  /** Corridor maps use authored paths. Open maps use the full field and treat paths as spawn-to-fortress anchors. */
  navigationMode?: 'corridor' | 'open'
  solidPolygons?: MapSolidPolygon[]
  obstacles?: MapObstacle[]
  /** Visual-only terrain stamps authored in Map Forge. */
  decorations?: MapDecoration[]
  secondaryObjective?: MapSecondaryObjective
  /** Towers must be centered inside one of these circles when any are authored. */
  buildZones?: MapBuildZone[]
  /** Sandbox uses these waves instead of the standard wave set when present. */
  waves?: WaveDefinition[]
  palette?: {
    ground: string
    path: string
    background: string
    rock: string
  }
}

export type GameTuning = {
  budget: number
  towers: Record<TowerKind, TowerStats>
  enemies: Record<EnemyKind, EnemyStats>
  powers: Record<ActivePowerKind, PowerDefinition>
  wall: {
    cost: number
    health: number
    collisionRadius: number
  }
}

export type UpgradeBehaviorFlags = {
  armorPiercingRivets: boolean
  cannonClusterShells: boolean
  burningDeathSpread: boolean
  brittleFrozenEnemies: boolean
  chainFreeze: boolean
  teslaStun: boolean
  piercingLaser: boolean
  mortarStun: boolean
  mortarClusterShells: boolean
  strafeArmorBreak: boolean
  cryoFrozenGround: boolean
  nukeFallout: boolean
  wallSpikes: boolean
  wallBreakExplosion: boolean
}

/** Complete derived rules for one run. This is rebuilt from tuning + saved ranks. */
export type GameRules = {
  tuning: GameTuning
  powers: Record<ActivePowerKind, PowerDefinition>
  powerCharges: Record<ActivePowerKind, number | null>
  wall: {
    charges: number
    length: number
    lifetimeSeconds: number
    contactDamagePerSecond: number
    breakExplosionDamage: number
    rechargeSeconds: number
  }
  setup: {
    towerSlots: number
    powerSlots: number
    preparationRefundMultiplier: number
    fortressShield: number
  }
  behaviors: UpgradeBehaviorFlags
}

export type Placement = Point & {
  id: number
  kind: BuildTool
  temporary?: boolean
  rotation?: number
  targetingRule?: TargetingRule
  /** Omit for the standard model. Unknown or wrong-family ids safely play as standard. */
  variantId?: TowerVariantId | string
}

export type BattleSnapshot = {
  baseHealth: number
  fortressShield: number
  leaks: number
  enemiesAlive: number
  enemiesDefeated: number
  wavesCleared: number
  elapsedSeconds: number
  wave: number
  totalWaves: number | null
  spawned: number
  totalEnemies: number | null
  strafeCooldown: number
  powerCooldowns: Record<ActivePowerKind, number>
  damageByTower: Record<TowerKind, number>
  damageBySource: Record<DamageSource, number>
  secondaryObjectiveHealth: number | null
  secondaryObjectiveMaxHealth: number | null
  secondaryObjectiveBonusMedals: number
  bossWave: boolean
  waveRewardMultiplier: number
}

export type PowerCommand = {
  id: number
  kind: ActivePowerKind
  point: Point
  /** End of a drag-defined lane. Omitted by point powers and legacy callers. */
  lineEnd?: Point
}
