import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BUILT_IN_MAPS, DEFAULT_MAP } from './maps'
import { createCustomMap, deleteCustomMap, isMap, loadAvailableMaps, loadCustomMaps, loadMap, normalizeMap, storeMap, type MapStorage } from './mapStore'

const stored = new Map<string, string>()
vi.stubGlobal('window', { localStorage: {
  getItem: (key: string) => stored.get(key) ?? null,
  setItem: (key: string, value: string) => stored.set(key, value),
  removeItem: (key: string) => stored.delete(key),
} })

const storage: MapStorage = {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
}

describe('map format', () => {
  beforeEach(() => stored.clear())
  it.each(BUILT_IN_MAPS)('accepts built-in map $name', (map) => expect(isMap(map)).toBe(true))
  it('rejects a lane with fewer than two points', () => expect(isMap({ ...DEFAULT_MAP, paths: [[]] })).toBe(false))
  it('rejects lanes that end at different fortresses', () => expect(isMap({
    ...DEFAULT_MAP,
    paths: [DEFAULT_MAP.paths[0], [{ x: -5, z: -3 }, { x: 3, z: 3 }]],
  })).toBe(false))

  it('migrates a saved single path into one lane', () => {
    const { paths, ...legacy } = DEFAULT_MAP
    stored.set('orcfall-command-dev-map', JSON.stringify({ ...legacy, id: 'legacy-map', path: paths[0] }))
    expect(loadMap().paths).toEqual(paths)
    expect(loadCustomMaps(storage).map((map) => map.id)).toEqual(['legacy-map'])
  })

  it('falls back safely for invalid stored JSON', () => {
    stored.set('orcfall-command-dev-map', '{oops')
    expect(loadMap()).toBe(DEFAULT_MAP)
  })

  it('accepts off-route boulders and rejects route-blocking ones', () => {
    expect(isMap({ ...DEFAULT_MAP, obstacles: [{ x: 0, z: -5, radius: 0.7 }] })).toBe(true)
    expect(isMap({ ...DEFAULT_MAP, obstacles: [{ x: 0, z: 2.7, radius: 0.7 }] })).toBe(false)
  })

  it('rejects boulders crossing an edge or overlapping each other', () => {
    expect(isMap({ ...DEFAULT_MAP, obstacles: [{ x: 10.7, z: -5, radius: 0.7 }] })).toBe(false)
    expect(isMap({ ...DEFAULT_MAP, obstacles: [{ x: 0, z: -5, radius: 0.7 }, { x: 0.5, z: -5, radius: 0.7 }] })).toBe(false)
  })

  it('normalizes legacy JSON and rejects malformed palettes', () => {
    const { paths, ...legacy } = DEFAULT_MAP
    expect(isMap(normalizeMap({ ...legacy, path: paths[0] }))).toBe(true)
    const { palette: _palette, ...uncolored } = DEFAULT_MAP
    expect(normalizeMap(uncolored)).toMatchObject({ palette: DEFAULT_MAP.palette })
    expect(isMap({ ...DEFAULT_MAP, palette: { ground: 4 } })).toBe(false)
  })

  it('stores and reloads two custom maps independently', () => {
    const first = createCustomMap(DEFAULT_MAP, 'North Road', [],)
    const second = createCustomMap(DEFAULT_MAP, 'South Road', [first])
    storeMap(first, storage)
    storeMap(second, storage)

    expect(loadCustomMaps(storage).map((map) => map.name)).toEqual(['North Road', 'South Road'])
    expect(loadAvailableMaps(storage).slice(-2).map((map) => map.id)).toEqual([first.id, second.id])
  })

  it('falls back to the default when the selected custom map is deleted', () => {
    const custom = createCustomMap(DEFAULT_MAP, 'Temporary Front', [])
    storeMap(custom, storage)

    expect(deleteCustomMap(custom.id, storage)).toBe(DEFAULT_MAP)
    expect(loadMap(storage)).toBe(DEFAULT_MAP)
    expect(storage.getItem('orcfall-command-selected-map')).toBe(DEFAULT_MAP.id)
  })

  it('isolates corrupt library entries while preserving valid neighbors', () => {
    const first = createCustomMap(DEFAULT_MAP, 'Valid One', [])
    const second = createCustomMap(DEFAULT_MAP, 'Valid Two', [first])
    storage.setItem('orcfall-command-map-library', JSON.stringify({
      version: 1,
      maps: [first, { id: 'broken', paths: 'nope' }, second, { ...second, id: DEFAULT_MAP.id }],
    }))

    expect(loadCustomMaps(storage).map((map) => map.id)).toEqual([first.id, second.id])
  })

  it('reloads the selected custom map from the versioned library', () => {
    const custom = createCustomMap(DEFAULT_MAP, 'Reload Front', [])
    storeMap(custom, storage)

    expect(loadMap(storage)).toEqual(custom)
    expect(loadMap(storage)).not.toBe(custom)
  })

  it('validates and round-trips authored zones, palette, and waves', () => {
    const custom = createCustomMap({
      ...DEFAULT_MAP,
      buildZones: [{ x: 0, z: -5, radius: 1.5 }],
      waves: [{ groups: [{ enemy: 'runner', count: 7, interval: 0.3, startDelay: 1, lane: 0 }], intermission: 2 }],
      palette: { ground: '#493d34', path: '#80624a', background: '#171210', rock: '#7c6c61' },
    }, 'Authored Front', [])
    expect(isMap(custom)).toBe(true)
    storeMap(custom, storage)
    expect(loadMap(storage)).toEqual(custom)
  })

  it('validates and round-trips authored field dimensions and decoration stamps', () => {
    const custom = createCustomMap({
      ...DEFAULT_MAP,
      width: 26,
      depth: 18,
      pathWidth: 2.2,
      decorations: [
        { x: -8, z: -5, kind: 'tree' },
        { x: 2, z: -4, kind: 'shrub' },
        { x: 5, z: 4, kind: 'crater' },
      ],
    }, 'Decorated Front', [])
    expect(isMap(custom)).toBe(true)
    storeMap(custom, storage)
    expect(loadMap(storage)).toEqual(custom)
  })

  it('validates, clones, and round-trips open-field polygons', () => {
    const source = {
      ...DEFAULT_MAP,
      navigationMode: 'open' as const,
      solidPolygons: [{ kind: 'platform' as const, points: [{ x: -2, z: -5 }, { x: 0, z: -5 }, { x: 0, z: -3 }, { x: -2, z: -3 }] }],
    }
    const custom = createCustomMap(source, 'Polygon Front', [])
    expect(isMap(custom)).toBe(true)
    expect(custom.solidPolygons).not.toBe(source.solidPolygons)
    expect(custom.solidPolygons![0].points).not.toBe(source.solidPolygons[0].points)
    storeMap(custom, storage)
    expect(loadMap(storage)).toEqual(custom)
    expect(isMap({ ...source, solidPolygons: [{ points: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }] }] })).toBe(false)
  })

  it('rejects unknown or out-of-bounds decoration stamps', () => {
    expect(isMap({ ...DEFAULT_MAP, decorations: [{ x: 0, z: 0, kind: 'tower' }] })).toBe(false)
    expect(isMap({ ...DEFAULT_MAP, decorations: [{ x: DEFAULT_MAP.width, z: 0, kind: 'tree' }] })).toBe(false)
  })

  it('round-trips a supply cache and wave reward metadata', () => {
    const custom = createCustomMap({
      ...DEFAULT_MAP,
      secondaryObjective: { kind: 'supplyCache', x: 0.8, z: 2.7, health: 300, bonusMedals: 9 },
      waves: [{ groups: [{ enemy: 'ogre', count: 1, interval: 1 }], intermission: 2, multipliers: { health: 1.4, speed: 0.9, damage: 1.2 }, rewardMultiplier: 1.5, boss: true }],
    }, 'Bonus Front', [])
    expect(isMap(custom)).toBe(true)
    storeMap(custom, storage)
    expect(loadMap(storage)).toEqual(custom)
  })

  it('rejects invalid supply caches and wave reward metadata', () => {
    expect(isMap({ ...DEFAULT_MAP, secondaryObjective: { kind: 'supplyCache', x: 0, z: -6, health: 300, bonusMedals: 9 } })).toBe(false)
    expect(isMap({ ...DEFAULT_MAP, waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], intermission: 1, rewardMultiplier: 10 }]})).toBe(false)
    expect(isMap({ ...DEFAULT_MAP, waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], intermission: 1, multipliers: { health: 0 } }]})).toBe(false)
  })

  it('rejects build zones outside the field and wave groups with invalid lanes', () => {
    expect(isMap({ ...DEFAULT_MAP, buildZones: [{ x: 10.5, z: 0, radius: 1 }] })).toBe(false)
    expect(isMap({
      ...DEFAULT_MAP,
      waves: [{ groups: [{ enemy: 'grunt', count: 5, interval: 0.5, lane: 1 }], intermission: 1 }],
    })).toBe(false)
  })
})
