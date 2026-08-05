import { countEnemies, WAVES } from './config'
import { CAMPAIGN_WAVES_BY_MAP } from './campaignContent'
import { applyDifficultyToWave, getRunDifficulty } from './difficulty'
import { BUILT_IN_MAPS } from './maps'
import { createEmptyDamageBySource } from './damageSources'
import type { BattleSnapshot, ChallengeModifiers, DifficultyTier, EnemyKind, MapDefinition, RunRules, SpawnGroup, TowerKind, WaveDefinition } from './types'

export type CampaignMission = {
  id: string
  mapId: string
  title: string
  waves: readonly WaveDefinition[]
}

export type ChallengeDefinition = {
  id: string
  title: string
  description: string
  mapId: string
  modifiers: ChallengeModifiers
}

export const CAMPAIGN_MISSIONS: readonly CampaignMission[] = BUILT_IN_MAPS.map((map, index) => ({
  id: `mission-${index + 1}`,
  mapId: map.id,
  title: map.name,
  waves: CAMPAIGN_WAVES_BY_MAP[map.id] ?? WAVES,
}))

export const DEFAULT_RUN: RunRules = { mode: 'campaign', missionId: CAMPAIGN_MISSIONS[0].id, waves: CAMPAIGN_MISSIONS[0].waves }

export const CHALLENGES: readonly ChallengeDefinition[] = [
  { id: 'grounded', title: 'Grounded', description: 'No active battlefield powers.', mapId: 'green-march', modifiers: { noPowers: true } },
  { id: 'double-time', title: 'Double Time', description: 'The battle is locked to 2× speed.', mapId: 'twin-fork', modifiers: { forcedSpeed: 2 } },
  { id: 'last-brick', title: 'Last Brick', description: 'The fortress begins with one health.', mapId: 'frozen-pass', modifiers: { baseHealth: 1 } },
  { id: 'big-booms', title: 'Big Booms Only', description: 'Command loans Cannon, Rocket, Mortar, and Wall for this operation.', mapId: 'ash-fields', modifiers: { allowedTools: ['cannon', 'rocket', 'mortar', 'wall'] } },
  {
    id: 'walls-only',
    title: 'Walls Only',
    description: 'No towers. Command loans Field Walls and a repeatable Artillery Barrage so the horde can be defeated.',
    mapId: 'green-march',
    modifiers: { allowedTools: ['wall'], allowedPowers: ['wall', 'barrage'], allowEmptyDeployment: true },
  },
  {
    id: 'limited-slots',
    title: 'Limited Slots',
    description: 'Bring no more than one tower and one battlefield power.',
    mapId: 'twin-fork',
    modifiers: { towerSlots: 1, powerSlots: 1 },
  },
]

export function findMission(id: string): CampaignMission | undefined {
  return CAMPAIGN_MISSIONS.find((mission) => mission.id === id)
}

export function missionForMap(mapId: string): CampaignMission | undefined {
  return CAMPAIGN_MISSIONS.find((mission) => mission.mapId === mapId)
}

export function isMissionUnlocked(completed: readonly string[], id: string): boolean {
  const index = CAMPAIGN_MISSIONS.findIndex((mission) => mission.id === id)
  return index === 0 || (index > 0 && completed.includes(CAMPAIGN_MISSIONS[index - 1].id))
}

export function nextMissionId(completed: readonly string[]): string | null {
  return CAMPAIGN_MISSIONS.find((mission) => isMissionUnlocked(completed, mission.id) && !completed.includes(mission.id))?.id ?? null
}

export function runForMap(mode: 'campaign' | 'endless' | 'sandbox', map: string | Pick<MapDefinition, 'id' | 'waves'>, difficulty: DifficultyTier = 'standard'): RunRules {
  const mapId = typeof map === 'string' ? map : map.id
  if (mode === 'endless') return { mode: 'endless', difficulty }
  if (mode === 'sandbox') return { mode: 'sandbox', waves: typeof map === 'string' ? WAVES : map.waves ?? WAVES }
  const mission = missionForMap(mapId) ?? CAMPAIGN_MISSIONS[0]
  return { mode: 'campaign', missionId: mission.id, waves: mission.waves, difficulty }
}

export function findChallenge(id: string): ChallengeDefinition | undefined {
  return CHALLENGES.find((challenge) => challenge.id === id)
}

export function runForChallenge(id: string): RunRules {
  const challenge = findChallenge(id) ?? CHALLENGES[0]
  return { mode: 'challenge', challengeId: challenge.id, waves: WAVES, modifiers: challenge.modifiers }
}

export function getWave(run: RunRules, index: number): WaveDefinition | undefined {
  const wave = run.mode === 'endless' ? createEndlessWave(index) : run.waves[index]
  return wave ? applyDifficultyToWave(wave, getRunDifficulty(run)) : undefined
}

export function getRunTotals(run: RunRules): { waves: number | null; enemies: number | null } {
  return run.mode === 'endless'
    ? { waves: null, enemies: null }
    : { waves: run.waves.length, enemies: countEnemies(run.waves) }
}

export function getCompletedWaveRewardMultiplier(run: RunRules, wavesCleared: number): number {
  const count = Math.max(0, Math.floor(wavesCleared))
  if (count === 0) return 1
  let total = 0
  for (let index = 0; index < count; index += 1) total += getWave(run, index)?.rewardMultiplier ?? 1
  return total / count
}

export function createEndlessWave(index: number): WaveDefinition {
  const roster: EnemyKind[] = ['grunt']
  if (index >= 1) roster.push('runner')
  if (index >= 2) roster.push('shieldbearer')
  if (index >= 3) roster.push('brute')
  if (index >= 4) roster.push('shaman')
  if (index >= 5) roster.push('armored')
  if (index >= 6) roster.push('sapper')
  if (index >= 7) roster.push('banner')
  if (index >= 8) roster.push('berserker')
  const total = Math.min(90, 12 + index * 4)
  const bossCount = index > 0 && index % 5 === 4 ? 1 : 0
  const normalTotal = total - bossCount
  const baseCount = Math.max(1, Math.floor(normalTotal / roster.length))
  const groups: SpawnGroup[] = roster.map((enemy, groupIndex) => ({
    enemy,
    count: groupIndex === roster.length - 1 ? normalTotal - baseCount * (roster.length - 1) : baseCount,
    interval: Math.max(0.18, 0.52 - index * 0.012),
    startDelay: groupIndex * Math.max(0.55, 1.4 - index * 0.04),
  }))
  if (bossCount) groups.push({ enemy: 'ogre', count: 1, interval: 1.1, startDelay: 4.5 })
  return {
    groups,
    intermission: 1.2,
    boss: bossCount > 0,
    rewardMultiplier: bossCount > 0 ? 1.25 : 1,
    multipliers: {
      health: 1 + index * 0.12,
      damage: 1 + index * 0.06,
      speed: Math.min(1.45, 1 + index * 0.015),
    },
  }
}

export function createInitialSnapshot(run: RunRules, fortressShield = 0): BattleSnapshot {
  const totals = getRunTotals(run)
  const damageByTower: Record<TowerKind, number> = {
    gunner: 0, heavyGun: 0, cannon: 0, rocket: 0, flamethrower: 0,
    cryo: 0, tesla: 0, laser: 0, mortar: 0, support: 0,
  }
  return {
    baseHealth: run.mode === 'challenge' ? run.modifiers.baseHealth ?? 100 : 100,
    fortressShield,
    leaks: 0, enemiesAlive: 0, enemiesDefeated: 0, wavesCleared: 0, elapsedSeconds: 0,
    wave: 1, totalWaves: totals.waves, spawned: 0, totalEnemies: totals.enemies,
    strafeCooldown: 0, powerCooldowns: { strafe: 0, barrage: 0, cryoBeam: 0, nuke: 0, orbitalLaser: 0, repair: 0 }, damageByTower,
    damageBySource: createEmptyDamageBySource(),
    secondaryObjectiveHealth: null, secondaryObjectiveMaxHealth: null, secondaryObjectiveBonusMedals: 0,
    bossWave: false, waveRewardMultiplier: 1,
  }
}
