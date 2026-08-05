import { BUILT_IN_MAPS, DEFAULT_MAP, findBuiltInMap } from './maps'
import { buildPathInfo, distance, distanceToPath } from './path'
import type { EnemyKind, MapDecorationKind, MapDefinition, WaveDefinition } from './types'

const LEGACY_MAP_KEY = 'orcfall-command-dev-map'
const MAP_LIBRARY_KEY = 'orcfall-command-map-library'
const SELECTED_MAP_KEY = 'orcfall-command-selected-map'
const MAP_LIBRARY_VERSION = 1
const ENEMY_KINDS = new Set<EnemyKind>(['grunt', 'runner', 'brute', 'shieldbearer', 'armored', 'shaman', 'banner', 'sapper', 'berserker', 'ogre'])
const DECORATION_KINDS = new Set<MapDecorationKind>(['tree', 'shrub', 'crater'])

export type MapStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type StoredMapLibrary = {
  version: typeof MAP_LIBRARY_VERSION
  maps: unknown[]
}

export function loadMap(storage: MapStorage = window.localStorage): MapDefinition {
  const selectedId = storage.getItem(SELECTED_MAP_KEY)
  const selected = selectedId
    ? findBuiltInMap(selectedId) ?? loadCustomMaps(storage).find((map) => map.id === selectedId)
    : undefined
  if (selected) return selected
  storage.setItem(SELECTED_MAP_KEY, DEFAULT_MAP.id)
  return DEFAULT_MAP
}

export function storeMap(map: MapDefinition, storage: MapStorage = window.localStorage): void {
  if (!isMap(map)) return
  if (!findBuiltInMap(map.id)) storeCustomMaps(upsertMap(loadCustomMaps(storage), map), storage)
  storage.setItem(SELECTED_MAP_KEY, map.id)
}

export function loadAvailableMaps(storage: MapStorage = window.localStorage): MapDefinition[] {
  return [...BUILT_IN_MAPS, ...loadCustomMaps(storage)]
}

export function loadCustomMaps(storage: MapStorage = window.localStorage): MapDefinition[] {
  const stored = storage.getItem(MAP_LIBRARY_KEY)
  if (!stored) return migrateLegacyMap(storage)
  try {
    const library = JSON.parse(stored) as Partial<StoredMapLibrary>
    if (library.version !== MAP_LIBRARY_VERSION || !Array.isArray(library.maps)) return []
    return uniqueCustomMaps(library.maps)
  } catch {
    return []
  }
}

export function deleteCustomMap(id: string, storage: MapStorage = window.localStorage): MapDefinition {
  storeCustomMaps(loadCustomMaps(storage).filter((map) => map.id !== id), storage)
  if (storage.getItem(SELECTED_MAP_KEY) === id) storage.setItem(SELECTED_MAP_KEY, DEFAULT_MAP.id)
  return loadMap(storage)
}

export function createCustomMap(
  source: MapDefinition,
  name: string,
  existingMaps: readonly MapDefinition[],
): MapDefinition {
  const baseId = `custom-${slug(name)}`
  const existingIds = new Set([...BUILT_IN_MAPS, ...existingMaps].map((map) => map.id))
  let id = baseId
  let suffix = 2
  while (existingIds.has(id)) id = `${baseId}-${suffix++}`
  return {
    ...source,
    id,
    name: name.trim() || 'Untitled Front',
    paths: source.paths.map((path) => path.map((point) => ({ ...point }))),
    obstacles: source.obstacles?.map((obstacle) => ({ ...obstacle })),
    decorations: source.decorations?.map((decoration) => ({ ...decoration })),
    buildZones: source.buildZones?.map((zone) => ({ ...zone })),
    secondaryObjective: source.secondaryObjective ? { ...source.secondaryObjective } : undefined,
    waves: source.waves?.map((wave) => ({ ...wave, groups: wave.groups.map((group) => ({ ...group })) })),
    palette: source.palette ? { ...source.palette } : undefined,
  }
}

export function isMap(value: unknown): value is MapDefinition {
  if (!value || typeof value !== 'object') return false
  const map = value as Partial<MapDefinition>
  return typeof map.id === 'string' && map.id.trim().length > 0
    && typeof map.name === 'string' && map.name.trim().length > 0
    && typeof map.width === 'number' && Number.isFinite(map.width) && map.width >= 10
    && typeof map.depth === 'number' && Number.isFinite(map.depth) && map.depth >= 8
    && typeof map.pathWidth === 'number' && Number.isFinite(map.pathWidth) && map.pathWidth > 0 && map.pathWidth < Math.min(map.width, map.depth)
    && Array.isArray(map.paths) && map.paths.length >= 1
    && map.paths.every((path) => Array.isArray(path) && path.length >= 2
      && path.every((point) => typeof point?.x === 'number' && Number.isFinite(point.x) && Math.abs(point.x) <= map.width! / 2
        && typeof point?.z === 'number' && Number.isFinite(point.z) && Math.abs(point.z) <= map.depth! / 2)
      && buildPathInfo(path).totalLength >= 1)
    && pathsShareFortress(map.paths)
    && (map.palette === undefined || isPalette(map.palette))
    && (map.obstacles === undefined || Array.isArray(map.obstacles) && map.obstacles.every((obstacle) =>
      typeof obstacle?.radius === 'number' && Number.isFinite(obstacle.radius) && obstacle.radius >= 0.2 && obstacle.radius <= 2
      && typeof obstacle?.x === 'number' && Number.isFinite(obstacle.x) && Math.abs(obstacle.x) + obstacle.radius <= map.width! / 2
      && typeof obstacle?.z === 'number' && Number.isFinite(obstacle.z) && Math.abs(obstacle.z) + obstacle.radius <= map.depth! / 2
      && map.paths!.every((path) => distanceToPath(obstacle, path) > map.pathWidth! / 2 + obstacle.radius)))
    && (map.obstacles === undefined || map.obstacles.every((obstacle, index, all) =>
      all.every((other, otherIndex) => index === otherIndex || distance(obstacle, other) >= obstacle.radius + other.radius)))
    && (map.decorations === undefined || Array.isArray(map.decorations) && map.decorations.length <= 120
      && map.decorations.every((decoration) => Boolean(decoration) && DECORATION_KINDS.has(decoration.kind)
        && typeof decoration.x === 'number' && Number.isFinite(decoration.x) && Math.abs(decoration.x) <= map.width! / 2
        && typeof decoration.z === 'number' && Number.isFinite(decoration.z) && Math.abs(decoration.z) <= map.depth! / 2))
    && (map.buildZones === undefined || Array.isArray(map.buildZones) && map.buildZones.length <= 24 && map.buildZones.every((zone) =>
      typeof zone?.radius === 'number' && Number.isFinite(zone.radius) && zone.radius >= 0.5 && zone.radius <= 10
      && typeof zone?.x === 'number' && Number.isFinite(zone.x) && Math.abs(zone.x) + zone.radius <= map.width! / 2
      && typeof zone?.z === 'number' && Number.isFinite(zone.z) && Math.abs(zone.z) + zone.radius <= map.depth! / 2))
    && (map.secondaryObjective === undefined || isSecondaryObjective(map.secondaryObjective, map))
    && (map.waves === undefined || Array.isArray(map.waves) && map.waves.length >= 1 && map.waves.length <= 30
      && map.waves.every((wave) => isWaveDefinition(wave, map.paths!.length)))
}

export function normalizeMap(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  let normalized = record
  if (Array.isArray(record.path) && !Array.isArray(record.paths)) {
    const { path, ...rest } = record
    normalized = { ...rest, paths: [path] }
  }
  return normalized.palette === undefined ? { ...normalized, palette: DEFAULT_MAP.palette } : normalized
}

export function isWaveDefinition(value: unknown, laneCount: number): value is WaveDefinition {
  if (!value || typeof value !== 'object') return false
  const wave = value as Partial<WaveDefinition>
  return typeof wave.intermission === 'number' && Number.isFinite(wave.intermission) && wave.intermission >= 0 && wave.intermission <= 60
    && Array.isArray(wave.groups) && wave.groups.length >= 1 && wave.groups.length <= 16
    && wave.groups.every((group) => Boolean(group) && typeof group === 'object'
      && ENEMY_KINDS.has(group.enemy)
      && Number.isInteger(group.count) && group.count >= 1 && group.count <= 5_000
      && typeof group.interval === 'number' && Number.isFinite(group.interval) && group.interval >= 0.05 && group.interval <= 30
      && (group.startDelay === undefined || typeof group.startDelay === 'number' && Number.isFinite(group.startDelay) && group.startDelay >= 0 && group.startDelay <= 120)
      && (group.lane === undefined || Number.isInteger(group.lane) && group.lane >= 0 && group.lane < laneCount))
    && (wave.multipliers === undefined || isMultipliers(wave.multipliers))
    && (wave.rewardMultiplier === undefined || typeof wave.rewardMultiplier === 'number' && Number.isFinite(wave.rewardMultiplier) && wave.rewardMultiplier >= 0.25 && wave.rewardMultiplier <= 5)
    && (wave.boss === undefined || typeof wave.boss === 'boolean')
}

function isSecondaryObjective(value: unknown, map: Partial<MapDefinition>): boolean {
  if (!value || typeof value !== 'object' || !map.paths || !map.width || !map.depth || !map.pathWidth) return false
  const objective = value as Record<string, unknown>
  if (objective.kind !== 'supplyCache' || typeof objective.x !== 'number' || !Number.isFinite(objective.x)
    || typeof objective.z !== 'number' || !Number.isFinite(objective.z)) return false
  const point = { x: objective.x, z: objective.z }
  return Math.abs(point.x) + 0.7 <= map.width / 2 && Math.abs(point.z) + 0.7 <= map.depth / 2
    && map.paths.some((path) => distanceToPath(point, path) <= map.pathWidth! / 2 + 0.25)
    && typeof objective.health === 'number' && Number.isFinite(objective.health) && objective.health >= 25 && objective.health <= 5_000
    && typeof objective.bonusMedals === 'number' && Number.isInteger(objective.bonusMedals) && objective.bonusMedals >= 1 && objective.bonusMedals <= 100
}

function migrateLegacyMap(storage: MapStorage): MapDefinition[] {
  const legacy = storage.getItem(LEGACY_MAP_KEY)
  if (!legacy) return []
  try {
    const map = normalizeMap(JSON.parse(legacy) as unknown)
    const maps = isMap(map) && !findBuiltInMap(map.id) ? [map] : []
    storeCustomMaps(maps, storage)
    return maps
  } catch {
    storeCustomMaps([], storage)
    return []
  }
}

function uniqueCustomMaps(values: readonly unknown[]): MapDefinition[] {
  const maps: MapDefinition[] = []
  const ids = new Set<string>()
  for (const value of values) {
    const map = normalizeMap(value)
    if (!isMap(map) || findBuiltInMap(map.id) || ids.has(map.id)) continue
    ids.add(map.id)
    maps.push(map)
  }
  return maps
}

function storeCustomMaps(maps: readonly MapDefinition[], storage: MapStorage): void {
  const library: StoredMapLibrary = { version: MAP_LIBRARY_VERSION, maps: [...maps] }
  storage.setItem(MAP_LIBRARY_KEY, JSON.stringify(library))
}

function upsertMap(maps: readonly MapDefinition[], map: MapDefinition): MapDefinition[] {
  const index = maps.findIndex((candidate) => candidate.id === map.id)
  if (index < 0) return [...maps, map]
  return maps.map((candidate, candidateIndex) => candidateIndex === index ? map : candidate)
}

function isPalette(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const palette = value as Record<string, unknown>
  return ['ground', 'path', 'background', 'rock'].every((key) => typeof palette[key] === 'string')
}

function isMultipliers(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const multipliers = value as Record<string, unknown>
  return ['health', 'speed', 'damage'].every((key) => multipliers[key] === undefined
    || typeof multipliers[key] === 'number' && Number.isFinite(multipliers[key]) && (multipliers[key] as number) > 0 && (multipliers[key] as number) <= 20)
}

function pathsShareFortress(paths: MapDefinition['paths']): boolean {
  const fortress = paths[0]?.at(-1)
  if (!fortress) return false
  return paths.every((path) => {
    const end = path.at(-1)
    return Boolean(end && Math.hypot(end.x - fortress.x, end.z - fortress.z) <= 0.25)
  })
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'map'
}
