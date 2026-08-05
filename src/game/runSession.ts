import { createRunPowerCharges, type PowerChargeState } from './powerCharges'
import { createInitialSnapshot, getCompletedWaveRewardMultiplier } from './runs'
import type { RunResult } from './save'
import type { BattleSnapshot, GameRules, Placement, RunRules } from './types'

export type BattleSessionStart = {
  snapshot: BattleSnapshot
  wallCharges: number
  wallCooldown: number
  powerCharges: PowerChargeState
}

/** Values that must reset together whenever a new battle begins. */
export function createBattleSessionStart(run: RunRules, rules: GameRules): BattleSessionStart {
  return {
    snapshot: createInitialSnapshot(run, rules.setup.fortressShield),
    wallCharges: rules.wall.charges,
    wallCooldown: 0,
    powerCharges: createRunPowerCharges(rules),
  }
}

/** Converts the simulation's final snapshot into the stable save-layer result shape. */
export function createRunResult(run: RunRules, snapshot: BattleSnapshot, won: boolean): RunResult {
  return {
    mode: run.mode,
    missionId: run.mode === 'campaign' ? run.missionId : undefined,
    challengeId: run.mode === 'challenge' ? run.challengeId : undefined,
    difficulty: run.mode === 'campaign' || run.mode === 'endless' ? run.difficulty : undefined,
    won,
    kills: snapshot.enemiesDefeated,
    wavesCleared: snapshot.wavesCleared,
    elapsedSeconds: snapshot.elapsedSeconds,
    baseHealth: snapshot.baseHealth,
    rewardMultiplier: getCompletedWaveRewardMultiplier(run, snapshot.wavesCleared),
    objectiveSurvived: snapshot.secondaryObjectiveHealth !== null && snapshot.secondaryObjectiveHealth > 0,
    objectiveBonusMedals: snapshot.secondaryObjectiveBonusMedals,
  }
}

export function keepPermanentPlacements(placements: readonly Placement[]): Placement[] {
  return placements.filter((placement) => !placement.temporary)
}
