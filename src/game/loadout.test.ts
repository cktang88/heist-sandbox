import { describe, expect, it } from 'vitest'
import { DEFAULT_TUNING } from './config'
import { applyCommanderDoctrine, canStartWithDeployment, DEFAULT_LOADOUT, getRunLoadoutLimits, getSetupBuildTools, loadoutsEqual, normalizeCommanderDoctrine, normalizeLoadout, resolveRunLoadout, toggleLoadoutPower, toggleLoadoutTower, validateLoadout } from './loadout'
import { deriveGameRules } from './upgrades'
import type { CombatPower, TowerKind } from './types'

const towers: TowerKind[] = ['gunner', 'cannon', 'rocket', 'cryo', 'laser']
const powers: CombatPower[] = ['strafe', 'nuke', 'repair', 'wall']

describe('pre-run loadouts', () => {
  it('keeps a fresh player equipped with the starter gunner', () => {
    expect(normalizeLoadout({ towers: [], powers: [] }, ['gunner'], [])).toEqual(DEFAULT_LOADOUT)
    expect(toggleLoadoutTower(DEFAULT_LOADOUT, 'gunner', ['gunner'], [])).toEqual(DEFAULT_LOADOUT)
  })

  it('removes unavailable choices, duplicate choices, and excess slots', () => {
    expect(normalizeLoadout(
      { towers: ['gunner', 'cannon', 'cannon', 'rocket', 'cryo', 'laser'], powers: ['strafe', 'nuke', 'nuke', 'repair', 'wall'] },
      towers,
      powers,
    )).toEqual({ towers: ['gunner', 'cannon', 'rocket', 'cryo'], powers: ['strafe', 'nuke', 'repair'], doctrine: null })
  })

  it('toggles choices without exceeding four towers or three powers', () => {
    const full = { towers: towers.slice(0, 4), powers: powers.slice(0, 3), doctrine: null }
    expect(toggleLoadoutTower(full, 'laser', towers, powers)).toEqual(full)
    expect(toggleLoadoutPower(full, 'wall', towers, powers)).toEqual(full)
    expect(toggleLoadoutPower(full, 'nuke', towers, powers).powers).toEqual(['strafe', 'repair'])
  })

  it('respects a smaller run slot allowance without changing the absolute caps', () => {
    const limits = { towerSlots: 3, powerSlots: 2 }
    expect(normalizeLoadout({ towers, powers }, towers, powers, limits)).toEqual({
      towers: ['gunner', 'cannon', 'rocket'], powers: ['strafe', 'nuke'], doctrine: null,
    })
    expect(toggleLoadoutTower({ towers: towers.slice(0, 3), powers: [] }, 'cryo', towers, powers, limits).towers).toEqual(towers.slice(0, 3))
  })

  it('keeps a fourth tower when Expanded Loadout supplies the fourth slot', () => {
    const limits = { towerSlots: deriveGameRules(DEFAULT_TUNING, { 'command-03': 1 }).setup.towerSlots, powerSlots: 3 }
    expect(normalizeLoadout({ towers: towers.slice(0, 4), powers: [] }, towers, powers, limits).towers).toHaveLength(4)
  })

  it('reports invalid selections for callers that need validation feedback', () => {
    expect(validateLoadout({ towers: [], powers: ['wall', 'wall'] }, ['gunner'], [])).toEqual([
      'Choose at least one tower.',
      'Power loadout contains an unavailable power.',
    ])
    expect(validateLoadout(DEFAULT_LOADOUT, ['gunner'], [])).toEqual([])
  })

  it('lets challenge rules replace the player arsenal and disable powers', () => {
    expect(resolveRunLoadout(DEFAULT_LOADOUT, { allowedTools: ['cannon', 'rocket', 'mortar', 'wall'] })).toEqual({
      towers: ['cannon', 'rocket', 'mortar'], powers: ['wall'], doctrine: null,
    })
    expect(resolveRunLoadout({ towers: ['gunner'], powers: ['strafe'] }, { noPowers: true })).toEqual({ towers: ['gunner'], powers: [] })
  })

  it('makes Walls Only startable with its loaned repeatable damage power', () => {
    const modifiers = { allowedTools: ['wall'] as const, allowedPowers: ['wall', 'barrage'] as const, allowEmptyDeployment: true }
    expect(resolveRunLoadout(DEFAULT_LOADOUT, modifiers)).toEqual({ towers: [], powers: ['wall', 'barrage'], doctrine: null })
    expect(canStartWithDeployment(false, modifiers)).toBe(true)
    expect(canStartWithDeployment(false)).toBe(false)
  })

  it('enforces Limited Slots through the normal loadout limits', () => {
    const limits = getRunLoadoutLimits({ towerSlots: 4, powerSlots: 3 }, { towerSlots: 1, powerSlots: 1 })
    expect(limits).toEqual({ towerSlots: 1, powerSlots: 1 })
    expect(normalizeLoadout({ towers, powers }, towers, powers, limits)).toEqual({ towers: ['gunner'], powers: ['strafe'], doctrine: null })
  })

  it('compares normalized run-local selections by slot order', () => {
    expect(loadoutsEqual(DEFAULT_LOADOUT, { towers: ['gunner'], powers: [] })).toBe(true)
    expect(loadoutsEqual(DEFAULT_LOADOUT, { towers: ['gunner'], powers: ['wall'] })).toBe(false)
  })

  it('normalizes and applies the one Commander Doctrine directly', () => {
    expect(normalizeCommanderDoctrine('unknown')).toBeNull()
    expect(normalizeCommanderDoctrine('forwardSupply')).toBe('forwardSupply')
    const base = deriveGameRules(DEFAULT_TUNING, {})
    expect(applyCommanderDoctrine(base, 'forwardSupply').tuning.budget).toBe(base.tuning.budget + 30)
    expect(applyCommanderDoctrine(base, null)).toBe(base)
  })

  it('offers a researched starting wall without consuming the combat wall power slot', () => {
    const loadout = { towers: ['gunner'] as const, powers: ['strafe'] as const, doctrine: null }
    expect(getSetupBuildTools(loadout, true)).toEqual(['gunner', 'wall'])
    expect(getSetupBuildTools(loadout, false)).toEqual(['gunner'])
    expect(loadout.powers).toEqual(['strafe'])
  })
})
