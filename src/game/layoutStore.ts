import { isValidPlacement } from './placement'
import { defaultTowerRotation } from './towerFacing'
import type { BuildTool, CombatPower, GameTuning, MapDefinition, Placement, TargetingRule, TowerKind } from './types'

const LAYOUT_KEY = 'orcfall-command-defense-layouts'
const LAYOUT_VERSION = 1
const MAX_LAYOUTS = 200
const MAX_PLACEMENTS = 500

const BUILD_TOOLS = new Set<BuildTool>([
  'gunner', 'heavyGun', 'cannon', 'rocket', 'flamethrower', 'cryo', 'tesla', 'laser', 'mortar', 'support', 'wall',
])
const TARGETING_RULES = new Set<TargetingRule>(['first', 'closest', 'strongest', 'weakest', 'densest'])

export type LayoutStorage = Pick<Storage, 'getItem' | 'setItem'>

type StoredLayouts = {
  version: typeof LAYOUT_VERSION
  layouts: { mapId: string; placements: Placement[]; variants: Record<string, string>; loadout?: SavedLevelLoadout }[]
}

export type SavedLevelLoadout = { towers: TowerKind[]; powers: CombatPower[] }

export type SavedDefenseLayout = {
  placements: Placement[]
  /** Tower-kind to selected variant id. Unknown ids are preserved for the upgrade system to interpret. */
  variants: Record<string, string>
  /** Tower and power choices belong to this level, not whichever level was viewed last. */
  loadout?: SavedLevelLoadout
}

export function layoutIdForLevel(mapId: string, challengeId?: string): string {
  return challengeId ? `challenge:${challengeId}` : `map:${mapId}`
}

/** Loads one permanent deployment. Invalid or battle-only values are discarded. */
export function loadLayout(mapId: string, storage: LayoutStorage = window.localStorage): Placement[] {
  return loadDefenseLayout(mapId, storage).placements
}

export function loadDefenseLayout(mapId: string, storage: LayoutStorage = window.localStorage): SavedDefenseLayout {
  const saved = readLayouts(storage).find((entry) => entry.mapId === mapId)
  return saved
    ? { placements: saved.placements.map((placement) => ({ ...placement })), variants: { ...saved.variants }, loadout: saved.loadout ? { towers: [...saved.loadout.towers], powers: [...saved.loadout.powers] } : undefined }
    : { placements: [], variants: {} }
}

/** Stores one deployment without temporary combat walls. */
export function storeLayout(
  mapId: string,
  placements: readonly Placement[],
  storage: LayoutStorage = window.localStorage,
): void {
  if (!validMapId(mapId)) return
  const stored = readLayouts(storage)
  const previousVariants = stored.find((entry) => entry.mapId === mapId)?.variants ?? {}
  const previousLoadout = stored.find((entry) => entry.mapId === mapId)?.loadout
  storeDefenseLayout(mapId, { placements: [...placements], variants: previousVariants, loadout: previousLoadout }, storage)
}

export function storeDefenseLayout(
  mapId: string,
  layout: SavedDefenseLayout,
  storage: LayoutStorage = window.localStorage,
): void {
  if (!validMapId(mapId)) return
  const stored = readLayouts(storage)
  const layouts = stored.filter((entry) => entry.mapId !== mapId)
  layouts.push({ mapId, placements: sanitizePlacements(layout.placements), variants: sanitizeVariants(layout.variants), loadout: sanitizeLoadout(layout.loadout) })
  const value: StoredLayouts = { version: LAYOUT_VERSION, layouts: layouts.slice(-MAX_LAYOUTS) }
  storage.setItem(LAYOUT_KEY, JSON.stringify(value))
}

/** Revalidates a saved deployment against today's map, unlocks and budget. */
export function restoreLayout(
  placements: readonly Placement[],
  map: MapDefinition,
  allowedTools: readonly BuildTool[],
  _tuning: GameTuning,
): Placement[] {
  const allowed = new Set(allowedTools)
  const restored: Placement[] = []
  for (const placement of sanitizePlacements(placements)) {
    if (!allowed.has(placement.kind)) continue
    if (!isValidPlacement(placement, placement.kind, restored, map)) continue
    restored.push(placement.kind !== 'wall' && placement.rotation === undefined
      ? { ...placement, rotation: defaultTowerRotation(map, placement) }
      : placement)
  }
  return restored
}

function readLayouts(storage: LayoutStorage): StoredLayouts['layouts'] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(LAYOUT_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return []
    const candidate = parsed as Partial<StoredLayouts>
    if (candidate.version !== LAYOUT_VERSION || !Array.isArray(candidate.layouts)) return []
    return candidate.layouts.slice(-MAX_LAYOUTS).flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const value = entry as { mapId?: unknown; placements?: unknown; variants?: unknown; loadout?: unknown }
      if (!validMapId(value.mapId) || !Array.isArray(value.placements)) return []
      return [{ mapId: value.mapId, placements: sanitizePlacements(value.placements), variants: sanitizeVariants(value.variants), loadout: sanitizeLoadout(value.loadout) }]
    })
  } catch {
    return []
  }
}

function sanitizeLoadout(value: unknown): SavedLevelLoadout | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const candidate = value as { towers?: unknown; powers?: unknown }
  if (!Array.isArray(candidate.towers) || !Array.isArray(candidate.powers)) return undefined
  const towers = [...new Set(candidate.towers.filter((item): item is TowerKind => typeof item === 'string' && BUILD_TOOLS.has(item as BuildTool) && item !== 'wall'))]
  const powerKinds = new Set<CombatPower>(['wall', 'strafe', 'barrage', 'cryoBeam', 'nuke', 'orbitalLaser', 'repair'])
  const powers = [...new Set(candidate.powers.filter((item): item is CombatPower => typeof item === 'string' && powerKinds.has(item as CombatPower)))]
  return { towers, powers }
}

function sanitizeVariants(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const variants: Record<string, string> = {}
  for (const [key, variant] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    if (key.length > 0 && key.length <= 80 && typeof variant === 'string' && variant.length > 0 && variant.length <= 80) variants[key] = variant
  }
  return variants
}

function sanitizePlacements(values: readonly unknown[]): Placement[] {
  const placements: Placement[] = []
  const usedIds = new Set<number>()
  let nextId = 1
  for (const value of values.slice(0, MAX_PLACEMENTS)) {
    if (!value || typeof value !== 'object') continue
    const candidate = value as Partial<Placement>
    if (!finite(candidate.x) || !finite(candidate.z) || !BUILD_TOOLS.has(candidate.kind as BuildTool)) continue
    // Temporary walls belong to a battle, never to a reusable deployment.
    if (candidate.temporary) continue
    let id = Number.isSafeInteger(candidate.id) && candidate.id! >= 0 && !usedIds.has(candidate.id!) ? candidate.id! : nextId
    while (usedIds.has(id)) id = ++nextId
    usedIds.add(id)
    nextId++
    const kind = candidate.kind as BuildTool
    const rotation = finite(candidate.rotation) ? candidate.rotation : undefined
    const targetingRule = kind !== 'wall' && TARGETING_RULES.has(candidate.targetingRule as TargetingRule)
      ? candidate.targetingRule as TargetingRule
      : kind !== 'wall' ? 'closest' : undefined
    const variantId = kind !== 'wall' && typeof candidate.variantId === 'string' && candidate.variantId.length <= 80
      ? candidate.variantId
      : undefined
    placements.push({ id, kind, x: candidate.x!, z: candidate.z!, rotation, targetingRule, variantId })
  }
  return placements
}

function validMapId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 160
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}
