import { describe, expect, it } from 'vitest'
import {
  getTowerVariantChoices,
  getUnlockedTowerVariants,
  isTowerVariantSelectionsEqual,
  normalizeTowerVariantSelection,
  normalizeTowerVariantSelections,
  selectTowerVariant,
} from './variantSelection'
import type { UpgradeRanks } from './upgrades'

describe('tower variant selection', () => {
  it('always offers Standard and hides unresearched special variants', () => {
    expect(getTowerVariantChoices('gunner', {})).toEqual([
      { id: null, label: 'Standard', role: 'Original balanced weapon profile' },
    ])
  })

  it('offers only special variants unlocked by owned research', () => {
    const ranks: UpgradeRanks = { 'gunner-03': 1, 'gunner-05': 1 }

    expect(getUnlockedTowerVariants('gunner', ranks).map((variant) => variant.id)).toEqual([
      'gunner-armor-piercer',
      'gunner-rapid-feed',
    ])
    expect(getTowerVariantChoices('gunner', ranks)).toHaveLength(3)
    expect(getUnlockedTowerVariants('heavyGun', ranks).map((variant) => variant.id)).toEqual(['heavy-anti-armor'])
  })

  it('normalizes locked, unknown, and wrong-family saved ids to Standard', () => {
    const ranks: UpgradeRanks = { 'gunner-05': 1, 'explosives-04': 1 }

    expect(normalizeTowerVariantSelection('gunner', 'gunner-armor-piercer', ranks)).toBe('gunner-armor-piercer')
    expect(normalizeTowerVariantSelection('gunner', 'gunner-armor-piercer', {})).toBeUndefined()
    expect(normalizeTowerVariantSelection('gunner', 'cannon-hypervelocity', ranks)).toBeUndefined()
    expect(normalizeTowerVariantSelection('gunner', 'from-a-future-save', ranks)).toBeUndefined()
    expect(normalizeTowerVariantSelection('gunner', null, ranks)).toBeUndefined()
  })

  it('keeps at most one choice for each equipped tower and drops other saved keys', () => {
    const ranks: UpgradeRanks = { 'gunner-03': 1, 'explosives-04': 1 }

    expect(normalizeTowerVariantSelections({
      gunner: 'gunner-rapid-feed',
      cannon: 'cannon-hypervelocity',
      rocket: 'rocket-salvo',
      unknownTower: 'gunner-armor-piercer',
    }, ['gunner', 'cannon'], ranks)).toEqual({
      gunner: 'gunner-rapid-feed',
      cannon: 'cannon-hypervelocity',
    })
  })

  it('replaces a special choice and returns to Standard without mutating the input', () => {
    const ranks: UpgradeRanks = { 'gunner-03': 1, 'gunner-05': 1 }
    const first = selectTowerVariant({}, 'gunner', 'gunner-armor-piercer', ranks)
    const second = selectTowerVariant(first, 'gunner', 'gunner-rapid-feed', ranks)
    const standard = selectTowerVariant(second, 'gunner', null, ranks)

    expect(first).toEqual({ gunner: 'gunner-armor-piercer' })
    expect(second).toEqual({ gunner: 'gunner-rapid-feed' })
    expect(standard).toEqual({})
  })

  it('compares mappings by every known tower choice', () => {
    expect(isTowerVariantSelectionsEqual({ gunner: 'gunner-rapid-feed' }, { gunner: 'gunner-rapid-feed' })).toBe(true)
    expect(isTowerVariantSelectionsEqual({ gunner: 'gunner-rapid-feed' }, { gunner: 'gunner-armor-piercer' })).toBe(false)
  })
})
