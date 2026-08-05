import { describe, expect, it } from 'vitest'
import { BROKEN_CITADEL, BUILT_IN_MAPS, DEFAULT_MAP } from './maps'
import { CAMPAIGN_MISSIONS, createEndlessWave, createInitialSnapshot, getRunTotals, getWave, isMissionUnlocked, nextMissionId, runForChallenge, runForMap } from './runs'

describe('run rules', () => {
  it('unlocks campaign missions in order', () => {
    expect(isMissionUnlocked([], 'mission-1')).toBe(true)
    expect(isMissionUnlocked([], 'mission-2')).toBe(false)
    expect(isMissionUnlocked(['mission-1'], 'mission-2')).toBe(true)
    expect(nextMissionId(['mission-1'])).toBe('mission-2')
    expect(isMissionUnlocked(['unknown'], 'mission-2')).toBe(false)
  })

  it('creates deterministic endless waves that scale and cap speed', () => {
    expect(createEndlessWave(10)).toEqual(createEndlessWave(10))
    expect(createEndlessWave(10).multipliers!.health).toBeGreaterThan(createEndlessWave(0).multipliers!.health!)
    expect(createEndlessWave(100).multipliers!.speed).toBe(1.45)
  })

  it('applies selected difficulty to finite and endless wave rules', () => {
    expect(getWave(runForMap('campaign', DEFAULT_MAP, 'cadet'), 0)?.multipliers?.health).toBe(0.8)
    expect(getWave(runForMap('endless', DEFAULT_MAP, 'veteran'), 0)?.multipliers).toEqual({ health: 1.35, speed: 1.08, damage: 1.3 })
  })

  it('spawns exactly one Ogre on each boss checkpoint', () => {
    for (const index of [4, 9, 14]) {
      const ogres = createEndlessWave(index).groups.find((group) => group.enemy === 'ogre')
      expect(ogres?.count).toBe(1)
    }
  })

  it('reports finite campaign totals and infinite endless totals', () => {
    const campaign = { mode: 'campaign' as const, missionId: CAMPAIGN_MISSIONS[0].id, waves: CAMPAIGN_MISSIONS[0].waves }
    expect(getRunTotals(campaign).waves).toBe(5)
    expect(getRunTotals(campaign).enemies).toBeGreaterThan(0)
    expect(getRunTotals({ mode: 'endless' })).toEqual({ waves: null, enemies: null })
  })

  it('gives every campaign mission a distinct five-wave composition and total', () => {
    const totals = CAMPAIGN_MISSIONS.map((mission) => getRunTotals({ mode: 'campaign', missionId: mission.id, waves: mission.waves }).enemies)
    const compositions = CAMPAIGN_MISSIONS.map((mission) => JSON.stringify(mission.waves.map((wave) =>
      wave.groups.map((group) => `${group.enemy}:${group.count}:${group.lane ?? '*'}`))))
    expect(CAMPAIGN_MISSIONS.every((mission) => mission.waves.length === 5)).toBe(true)
    expect(totals).toEqual([636, 816, 780, 876, 919])
    expect(new Set(totals).size).toBe(CAMPAIGN_MISSIONS.length)
    expect(new Set(compositions).size).toBe(CAMPAIGN_MISSIONS.length)
  })

  it('keeps every authored campaign lane inside its battlefield', () => {
    for (const mission of CAMPAIGN_MISSIONS) {
      const map = BUILT_IN_MAPS.find((candidate) => candidate.id === mission.mapId)!
      for (const wave of mission.waves) for (const group of wave.groups) {
        expect(group.lane === undefined || group.lane >= 0 && group.lane < map.paths.length).toBe(true)
      }
    }
  })

  it('escalates each mission from its opening wave to a larger mixed finale', () => {
    for (const mission of CAMPAIGN_MISSIONS) {
      const first = mission.waves[0]
      const finale = mission.waves.at(-1)!
      const count = (wave: typeof first) => wave.groups.reduce((sum, group) => sum + group.count, 0)
      expect(count(finale)).toBeGreaterThan(count(first))
      expect(new Set(finale.groups.map((group) => group.enemy)).size).toBeGreaterThan(new Set(first.groups.map((group) => group.enemy)).size)
    }
  })

  it('makes the Broken Citadel a limited-pad three-approach Ogre finale', () => {
    const mission = CAMPAIGN_MISSIONS.find((candidate) => candidate.mapId === BROKEN_CITADEL.id)!
    const ogres = mission.waves.flatMap((wave) => wave.groups).filter((group) => group.enemy === 'ogre')
    expect(BROKEN_CITADEL.paths).toHaveLength(3)
    expect(BROKEN_CITADEL.buildZones).toHaveLength(5)
    expect(ogres).toEqual([{ enemy: 'ogre', count: 1, interval: 1, startDelay: 5, lane: 1 }])
    expect(mission.waves.at(-1)?.groups).toContainEqual(ogres[0])
  })

  it('matches each advanced battlefield with its intended pressure roster', () => {
    const roster = (mapId: string) => new Set(CAMPAIGN_MISSIONS.find((mission) => mission.mapId === mapId)!.waves.flatMap((wave) => wave.groups.map((group) => group.enemy)))
    expect(roster('twin-fork')).toEqual(new Set(['grunt', 'runner', 'shieldbearer', 'sapper', 'brute']))
    expect(roster('frozen-pass')).toEqual(new Set(['grunt', 'shieldbearer', 'armored', 'runner', 'brute', 'shaman']))
    expect(roster('ash-fields')).toEqual(new Set(['grunt', 'armored', 'sapper', 'berserker', 'banner', 'brute']))
  })

  it('keeps old snapshot callers compatible while accepting a starting shield', () => {
    const run = runForMap('campaign', DEFAULT_MAP)
    expect(createInitialSnapshot(run).fortressShield).toBe(0)
    expect(createInitialSnapshot(run, 50).fortressShield).toBe(50)
  })

  it('describes challenge modifiers as run data', () => {
    expect(runForChallenge('grounded')).toMatchObject({ mode: 'challenge', modifiers: { noPowers: true } })
    expect(runForChallenge('double-time')).toMatchObject({ modifiers: { forcedSpeed: 2 } })
    expect(runForChallenge('last-brick')).toMatchObject({ modifiers: { baseHealth: 1 } })
    expect(runForChallenge('walls-only')).toMatchObject({ modifiers: { allowedTools: ['wall'], allowedPowers: ['wall', 'barrage'], allowEmptyDeployment: true } })
    expect(runForChallenge('limited-slots')).toMatchObject({ modifiers: { towerSlots: 1, powerSlots: 1 } })
  })

  it('uses map-authored waves and totals for Sandbox', () => {
    const map = {
      ...DEFAULT_MAP,
      id: 'custom-wave-front',
      waves: [{ groups: [
        { enemy: 'grunt' as const, count: 4, interval: 0.4 },
        { enemy: 'runner' as const, count: 3, interval: 0.25, startDelay: 1, lane: 0 },
      ], intermission: 2 }],
    }
    const run = runForMap('sandbox', map)
    expect(run).toMatchObject({ mode: 'sandbox', waves: map.waves })
    expect(getRunTotals(run)).toEqual({ waves: 1, enemies: 7 })
    expect(getRunTotals(runForMap('sandbox', DEFAULT_MAP)).waves).toBe(5)
  })
})
