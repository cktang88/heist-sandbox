import { describe, expect, it } from 'vitest'
import { DEFAULT_TUNING } from './config'
import { layoutIdForLevel, loadDefenseLayout, loadLayout, restoreLayout, storeDefenseLayout, storeLayout, type LayoutStorage } from './layoutStore'
import { DEFAULT_MAP } from './maps'
import { defaultTowerRotation } from './towerFacing'
import type { Placement } from './types'

function memoryStorage(): LayoutStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
  }
}

describe('saved defense layouts', () => {
  it('keeps a separate layout for every built-in or custom map id', () => {
    const storage = memoryStorage()
    const first: Placement = { id: 1, kind: 'gunner', x: -3, z: -3, targetingRule: 'first' }
    const second: Placement = { id: 2, kind: 'cannon', x: 4, z: 3, targetingRule: 'strongest' }
    storeLayout('map-one', [first], storage)
    storeLayout('custom-my-front', [second], storage)

    expect(loadLayout('map-one', storage)).toEqual([first])
    expect(loadLayout('custom-my-front', storage)).toEqual([second])
  })

  it('survives reloads and replaces only the selected map layout', () => {
    const storage = memoryStorage()
    storeLayout('one', [{ id: 1, kind: 'gunner', x: 0, z: 0 }], storage)
    storeLayout('two', [{ id: 2, kind: 'wall', x: 1, z: 0, rotation: 1.5 }], storage)
    storeLayout('one', [{ id: 3, kind: 'support', x: 2, z: 0 }], storage)

    expect(loadLayout('one', storage)).toEqual([{ id: 3, kind: 'support', x: 2, z: 0, targetingRule: 'closest' }])
    expect(loadLayout('two', storage)).toEqual([{ id: 2, kind: 'wall', x: 1, z: 0, rotation: 1.5 }])
  })

  it('round-trips optional tower variants without knowing future variant ids', () => {
    const storage = memoryStorage()
    storeDefenseLayout('one', {
      placements: [{ id: 1, kind: 'gunner', x: 0, z: 0, variantId: 'gunner-rapid-feed' }],
      variants: { gunner: 'split-shot', cannon: 'vanilla' },
    }, storage)
    storeLayout('one', loadLayout('one', storage), storage)

    expect(loadDefenseLayout('one', storage).variants).toEqual({ gunner: 'split-shot', cannon: 'vanilla' })
    expect(loadDefenseLayout('one', storage).placements[0].variantId).toBe('gunner-rapid-feed')
  })

  it('round-trips the tower and power loadout for the level', () => {
    const storage = memoryStorage()
    storeDefenseLayout('one', {
      placements: [], variants: {},
      loadout: { towers: ['gunner', 'cannon'], powers: ['strafe', 'wall'] },
    }, storage)
    expect(loadDefenseLayout('one', storage).loadout).toEqual({ towers: ['gunner', 'cannon'], powers: ['strafe', 'wall'] })
  })

  it('isolates a map deployment from challenges played on that map', () => {
    const storage = memoryStorage()
    const mapLevel = layoutIdForLevel('green-march')
    const challengeLevel = layoutIdForLevel('green-march', 'hold-the-line')
    storeLayout(mapLevel, [{ id: 1, kind: 'gunner', x: 0, z: 4 }], storage)
    storeLayout(challengeLevel, [{ id: 2, kind: 'wall', x: -4, z: -2.8 }], storage)

    expect(loadLayout(mapLevel, storage)[0]?.kind).toBe('gunner')
    expect(loadLayout(challengeLevel, storage)[0]?.kind).toBe('wall')
    expect(layoutIdForLevel('custom-my-front')).toBe('map:custom-my-front')
  })

  it('never saves temporary combat walls and repairs duplicate placement ids', () => {
    const storage = memoryStorage()
    storeLayout('one', [
      { id: 7, kind: 'gunner', x: 0, z: 0 },
      { id: 7, kind: 'cannon', x: 2, z: 0 },
      { id: 8, kind: 'wall', x: 1, z: 1, temporary: true },
    ], storage)

    const loaded = loadLayout('one', storage)
    expect(loaded).toHaveLength(2)
    expect(new Set(loaded.map((placement) => placement.id)).size).toBe(2)
    expect(loaded.every((placement) => !placement.temporary)).toBe(true)
  })

  it('ignores corrupted storage and malformed placement values', () => {
    const broken = { getItem: () => '{broken', setItem: () => undefined }
    expect(loadLayout('one', broken)).toEqual([])

    const storage = memoryStorage()
    storage.setItem('orcfall-command-defense-layouts', JSON.stringify({
      version: 1,
      layouts: [{ mapId: 'one', placements: [null, { id: 1, kind: 'gunner', x: 'bad', z: 0 }] }],
    }))
    expect(loadLayout('one', storage)).toEqual([])
  })

  it('keeps over-budget towers visible but drops locked, overlapping and invalid placements', () => {
    const tuning = { ...DEFAULT_TUNING, budget: DEFAULT_TUNING.towers.gunner.cost }
    const restored = restoreLayout([
      { id: 1, kind: 'gunner', x: 0, z: 4 },
      { id: 2, kind: 'gunner', x: 0.1, z: 4 },
      { id: 3, kind: 'gunner', x: -4, z: 4 },
      { id: 4, kind: 'gunner', x: 999, z: 999 },
    ], DEFAULT_MAP, ['gunner'], tuning)

    expect(restored).toEqual([{
      id: 1,
      kind: 'gunner',
      x: 0,
      z: 4,
      targetingRule: 'closest',
      rotation: defaultTowerRotation(DEFAULT_MAP, { x: 0, z: 4 }),
    }, {
      id: 3,
      kind: 'gunner',
      x: -4,
      z: 4,
      targetingRule: 'closest',
      rotation: defaultTowerRotation(DEFAULT_MAP, { x: -4, z: 4 }),
    }])
  })
})
