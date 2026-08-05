import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING } from './config'
import { createBattleSessionStart, createRunResult, keepPermanentPlacements } from './runSession'
import { DEFAULT_RUN, createInitialSnapshot } from './runs'

describe('run session lifecycle', () => {
  it('creates all battle-reset values from one run and rules object', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    rules.setup.fortressShield = 25
    rules.wall.charges = 4
    rules.powerCharges.strafe = 2
    const start = createBattleSessionStart(DEFAULT_RUN, rules)
    expect(start.snapshot.fortressShield).toBe(25)
    expect(start.wallCharges).toBe(4)
    expect(start.wallCooldown).toBe(0)
    expect(start.powerCharges.strafe).toBe(2)
  })

  it('builds the save result and removes only temporary placements', () => {
    const snapshot = { ...createInitialSnapshot(DEFAULT_RUN), enemiesDefeated: 12, wavesCleared: 2, elapsedSeconds: 30, baseHealth: 80 }
    expect(createRunResult(DEFAULT_RUN, snapshot, true)).toMatchObject({
      mode: 'campaign', missionId: 'mission-1', won: true, kills: 12, wavesCleared: 2, elapsedSeconds: 30, baseHealth: 80,
    })
    expect(keepPermanentPlacements([
      { id: 1, kind: 'gunner', x: 0, z: 0 },
      { id: 2, kind: 'wall', x: 1, z: 0, temporary: true },
    ])).toEqual([{ id: 1, kind: 'gunner', x: 0, z: 0 }])
  })
})
