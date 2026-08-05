import { describe, expect, it, vi } from 'vitest'
import { calculateRunReward, EMPTY_SAVE, loadSave, recordRun } from './save'

describe('run rewards', () => {
  it('rewards progress on defeat', () => {
    expect(recordRun(EMPTY_SAVE, result({ kills: 12 })).medals).toBe(3)
  })

  it('adds a victory bonus and records the best run', () => {
    const save = recordRun(EMPTY_SAVE, result({ kills: 40, won: true }))
    expect(save.medals).toBe(30)
    expect(save.bestKills).toBe(40)
    expect(save.totalRuns).toBe(1)
  })

  it('adds a separately reported Veteran difficulty bonus', () => {
    const veteran = result({ kills: 40, won: true, difficulty: 'veteran' })
    expect(calculateRunReward(EMPTY_SAVE, veteran)).toEqual({
      progressMedals: 10, victoryBonus: 20, objectiveBonus: 0, difficultyBonus: 10, total: 40,
    })
    expect(recordRun(EMPTY_SAVE, veteran).medals).toBe(40)
  })

  it('applies authored wave scaling and an intact objective bonus', () => {
    const reward = calculateRunReward(EMPTY_SAVE, result({ kills: 12, rewardMultiplier: 2, objectiveSurvived: true, objectiveBonusMedals: 7 }))
    expect(reward).toEqual({ progressMedals: 6, victoryBonus: 0, objectiveBonus: 7, difficultyBonus: 0, total: 13 })
  })

  it('unlocks a campaign mission once after victory', () => {
    const won = result({ won: true, missionId: 'mission-1' })
    const first = recordRun(EMPTY_SAVE, won)
    const second = recordRun(first, won)
    expect(second.completedMissionIds).toEqual(['mission-1'])
    expect(first.medals).toBe(21)
    expect(second.medals - first.medals).toBe(7)
  })

  it('records endless bests without lowering them', () => {
    const first = recordRun(EMPTY_SAVE, result({ mode: 'endless', wavesCleared: 5, kills: 80, elapsedSeconds: 90 }))
    const second = recordRun(first, result({ mode: 'endless', wavesCleared: 3, kills: 30, elapsedSeconds: 45 }))
    expect(second.bestEndlessWave).toBe(5)
    expect(second.bestEndlessKills).toBe(80)
    expect(second.bestEndlessScore).toBe(first.bestEndlessScore)
  })

  it('migrates version 3 saves without losing progress', () => {
    const oldSave = { version: 3, medals: 17, bestKills: 9, totalRuns: 2, upgrades: { 'gunner-01': 1, 'command-06': 1 } }
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify(oldSave) } })
    const migrated = loadSave()
    expect(migrated.medals).toBe(17)
    expect(migrated.version).toBe(7)
    expect(migrated.selectedDifficulty).toBe('standard')
    expect(migrated.selectedDoctrine).toBeNull()
    expect(migrated.completedMissionIds).toEqual([])
    expect(migrated.upgrades['command-06']).toBe(1)
  })

  it('preserves a valid saved difficulty and sanitizes an unknown one', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ ...EMPTY_SAVE, selectedDifficulty: 'veteran' }) } })
    expect(loadSave().selectedDifficulty).toBe('veteran')
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ ...EMPTY_SAVE, selectedDifficulty: 'nightmare' }) } })
    expect(loadSave().selectedDifficulty).toBe('standard')
  })

  it('preserves the known Commander Doctrine and removes unknown values', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ ...EMPTY_SAVE, selectedDoctrine: 'forwardSupply' }) } })
    expect(loadSave().selectedDoctrine).toBe('forwardSupply')
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ ...EMPTY_SAVE, selectedDoctrine: 'overpowered' }) } })
    expect(loadSave().selectedDoctrine).toBeNull()
  })

  it('does not award progression for sandbox runs', () => {
    expect(recordRun(EMPTY_SAVE, result({ mode: 'sandbox', won: true, kills: 999 }))).toBe(EMPTY_SAVE)
  })

  it('records a completed challenge only after victory', () => {
    const lost = recordRun(EMPTY_SAVE, result({ mode: 'challenge', challengeId: 'grounded' }))
    const won = recordRun(lost, result({ mode: 'challenge', challengeId: 'grounded', won: true }))
    expect(lost.completedChallengeIds).toEqual([])
    expect(won.completedChallengeIds).toEqual(['grounded'])
  })

  it('sanitizes corrupt endless values and non-sequential mission completion', () => {
    const corrupt = { version: 4, medals: 3, bestKills: 4, totalRuns: 1, upgrades: {}, completedMissionIds: ['mission-2'], bestEndlessWave: 'bad', bestEndlessKills: -4, bestEndlessScore: Infinity }
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify(corrupt) } })
    const loaded = loadSave()
    expect(loaded.completedMissionIds).toEqual([])
    expect([loaded.bestEndlessWave, loaded.bestEndlessKills, loaded.bestEndlessScore]).toEqual([0, 0, 0])
  })
})

function result(overrides: Partial<Parameters<typeof recordRun>[1]> = {}): Parameters<typeof recordRun>[1] {
  return { mode: 'campaign', missionId: 'mission-1', won: false, kills: 0, wavesCleared: 0, elapsedSeconds: 0, baseHealth: 0, ...overrides }
}
