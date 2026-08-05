import { sanitizeUpgradeRanks, STARTER_UPGRADES, type UpgradeRanks } from './upgrades'
import { CAMPAIGN_MISSIONS, CHALLENGES } from './runs'
import { getDifficulty, isDifficultyTier } from './difficulty'
import type { DifficultyTier } from './types'
import { normalizeCommanderDoctrine, type CommanderDoctrine } from './loadout'

const SAVE_KEY = 'orcfall-command-save'
const SAVE_VERSION = 7

export type RunResult = {
  mode: 'campaign' | 'endless' | 'challenge' | 'sandbox'
  missionId?: string
  challengeId?: string
  difficulty?: DifficultyTier
  won: boolean
  kills: number
  wavesCleared: number
  elapsedSeconds: number
  baseHealth: number
  rewardMultiplier?: number
  objectiveSurvived?: boolean
  objectiveBonusMedals?: number
}

export type SaveData = {
  version: number
  medals: number
  bestKills: number
  totalRuns: number
  completedMissionIds: string[]
  completedChallengeIds: string[]
  bestEndlessWave: number
  bestEndlessKills: number
  bestEndlessScore: number
  selectedDifficulty: DifficultyTier
  selectedDoctrine: CommanderDoctrine | null
  upgrades: UpgradeRanks
}

export const EMPTY_SAVE: SaveData = {
  version: SAVE_VERSION,
  medals: 0,
  bestKills: 0,
  totalRuns: 0,
  completedMissionIds: [],
  completedChallengeIds: [],
  bestEndlessWave: 0,
  bestEndlessKills: 0,
  bestEndlessScore: 0,
  selectedDifficulty: 'standard',
  selectedDoctrine: null,
  upgrades: { ...STARTER_UPGRADES },
}

export function loadSave(): SaveData {
  try {
    const stored = window.localStorage.getItem(SAVE_KEY)
    if (!stored) return EMPTY_SAVE
    const parsed: unknown = JSON.parse(stored)
    if (!parsed || typeof parsed !== 'object') return EMPTY_SAVE
    const candidate = parsed as Record<string, unknown>
    return {
      ...EMPTY_SAVE,
      medals: safeNumber(candidate.medals),
      bestKills: safeNumber(candidate.bestKills),
      totalRuns: safeNumber(candidate.totalRuns),
      completedMissionIds: sanitizeMissionIds(candidate.completedMissionIds),
      completedChallengeIds: sanitizeChallengeIds(candidate.completedChallengeIds),
      bestEndlessWave: safeNumber(candidate.bestEndlessWave),
      bestEndlessKills: safeNumber(candidate.bestEndlessKills),
      bestEndlessScore: safeNumber(candidate.bestEndlessScore),
      selectedDifficulty: isDifficultyTier(candidate.selectedDifficulty) ? candidate.selectedDifficulty : 'standard',
      selectedDoctrine: normalizeCommanderDoctrine(candidate.selectedDoctrine),
      upgrades: sanitizeUpgradeRanks(candidate.upgrades), version: SAVE_VERSION,
    }
  } catch {
    return EMPTY_SAVE
  }
}

export function storeSave(save: SaveData): void {
  window.localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}

export function recordRun(save: SaveData, result: RunResult): SaveData {
  if (result.mode === 'sandbox') return save
  const medalsEarned = calculateRunReward(save, result).total
  const endlessScore = result.mode === 'endless' ? calculateEndlessScore(result) : 0
  const completedMissionIds = result.mode === 'campaign' && result.won && result.missionId
    ? [...new Set([...save.completedMissionIds, result.missionId])]
    : save.completedMissionIds
  const completedChallengeIds = result.mode === 'challenge' && result.won && result.challengeId
    ? [...new Set([...save.completedChallengeIds, result.challengeId])]
    : save.completedChallengeIds
  return {
    ...save,
    version: SAVE_VERSION,
    medals: save.medals + medalsEarned,
    bestKills: Math.max(save.bestKills, result.kills),
    totalRuns: save.totalRuns + 1,
    completedMissionIds,
    completedChallengeIds,
    bestEndlessWave: result.mode === 'endless' ? Math.max(save.bestEndlessWave, result.wavesCleared) : save.bestEndlessWave,
    bestEndlessKills: result.mode === 'endless' ? Math.max(save.bestEndlessKills, result.kills) : save.bestEndlessKills,
    bestEndlessScore: Math.max(save.bestEndlessScore, endlessScore),
    upgrades: save.upgrades,
  }
}

export type RunReward = {
  progressMedals: number
  victoryBonus: number
  difficultyBonus: number
  objectiveBonus: number
  total: number
}

export function calculateRunReward(save: SaveData, result: RunResult): RunReward {
  const repeatedCampaignWin = result.mode === 'campaign' && result.won && result.missionId !== undefined && save.completedMissionIds.includes(result.missionId)
  const victoryBonus = result.won ? repeatedCampaignWin ? 6 : 20 : 0
  const baseProgress = Math.max(1, Math.floor(result.kills / 4)) + result.wavesCleared * 4
  const rewardMultiplier = Math.min(5, Math.max(0.25, result.rewardMultiplier ?? 1))
  const progressMedals = Math.max(1, Math.floor(baseProgress * rewardMultiplier))
  const objectiveBonus = result.objectiveSurvived ? Math.max(0, Math.floor(result.objectiveBonusMedals ?? 0)) : 0
  const earnsDifficultyBonus = result.mode === 'campaign' || result.mode === 'endless'
  const rate = earnsDifficultyBonus ? getDifficulty(result.difficulty ?? 'standard').medalBonusRate : 0
  const difficultyBonus = Math.floor((progressMedals + victoryBonus + objectiveBonus) * rate)
  return { progressMedals, victoryBonus, objectiveBonus, difficultyBonus, total: progressMedals + victoryBonus + objectiveBonus + difficultyBonus }
}

export function calculateEndlessScore(result: Pick<RunResult, 'wavesCleared' | 'kills' | 'elapsedSeconds' | 'baseHealth'>): number {
  const survivalBonus = Math.min(Math.floor(result.elapsedSeconds), result.wavesCleared * 120)
  return result.wavesCleared * 1000 + result.kills * 10 + survivalBonus + Math.max(0, result.baseHealth) * 5
}

function sanitizeMissionIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const stored = new Set(value.filter((id): id is string => typeof id === 'string'))
  const sequential: string[] = []
  for (const mission of CAMPAIGN_MISSIONS) {
    if (!stored.has(mission.id)) break
    sequential.push(mission.id)
  }
  return sequential
}

function sanitizeChallengeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const known = new Set(CHALLENGES.map((challenge) => challenge.id))
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && known.has(id)))]
}

function safeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}
