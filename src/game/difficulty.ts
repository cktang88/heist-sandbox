import type { DifficultyTier, EnemyMultipliers, RunRules, WaveDefinition } from './types'

export type DifficultyDefinition = {
  id: DifficultyTier
  label: string
  description: string
  multipliers: EnemyMultipliers
  medalBonusRate: number
}

export const DIFFICULTIES: readonly DifficultyDefinition[] = [
  {
    id: 'cadet',
    label: 'Cadet',
    description: 'Softer, slower hordes. Base medals.',
    multipliers: { health: 0.8, speed: 0.9, damage: 0.75 },
    medalBonusRate: 0,
  },
  {
    id: 'standard',
    label: 'Standard',
    description: 'Command baseline. Base medals.',
    multipliers: { health: 1, speed: 1, damage: 1 },
    medalBonusRate: 0,
  },
  {
    id: 'veteran',
    label: 'Veteran',
    description: 'Harder, faster hordes. +35% medals.',
    multipliers: { health: 1.35, speed: 1.08, damage: 1.3 },
    medalBonusRate: 0.35,
  },
]

export function getDifficulty(id: DifficultyTier): DifficultyDefinition {
  return DIFFICULTIES.find((difficulty) => difficulty.id === id) ?? DIFFICULTIES[1]
}

export function getRunDifficulty(run: RunRules): DifficultyTier {
  return run.mode === 'campaign' || run.mode === 'endless' ? run.difficulty ?? 'standard' : 'standard'
}

export function applyDifficultyToWave(wave: WaveDefinition, difficulty: DifficultyTier): WaveDefinition {
  const scale = getDifficulty(difficulty).multipliers
  return {
    ...wave,
    multipliers: {
      health: (wave.multipliers?.health ?? 1) * scale.health,
      speed: (wave.multipliers?.speed ?? 1) * scale.speed,
      damage: (wave.multipliers?.damage ?? 1) * scale.damage,
    },
  }
}

export function isDifficultyTier(value: unknown): value is DifficultyTier {
  return value === 'cadet' || value === 'standard' || value === 'veteran'
}
