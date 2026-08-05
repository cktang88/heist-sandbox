import { TOWER_KINDS } from './config'
import { getTowerVariant, getTowerVariants, type TowerVariantDefinition } from './towerVariants'
import type { TowerKind, TowerVariantId } from './types'
import type { UpgradeRanks } from './upgrades'

export type TowerVariantSelections = Partial<Record<TowerKind, TowerVariantId>>

export type TowerVariantChoice = {
  id: TowerVariantId | null
  label: string
  role: string
  accent?: string
}

export const STANDARD_VARIANT_CHOICE: TowerVariantChoice = {
  id: null,
  label: 'Standard',
  role: 'Original balanced weapon profile',
}

function ownsResearchNode(ranks: UpgradeRanks, variant: TowerVariantDefinition): boolean {
  return (ranks[variant.researchNode] ?? 0) > 0
}

export function getUnlockedTowerVariants(tower: TowerKind, ranks: UpgradeRanks): readonly TowerVariantDefinition[] {
  return getTowerVariants(tower).filter((variant) => ownsResearchNode(ranks, variant))
}

export function getTowerVariantChoices(tower: TowerKind, ranks: UpgradeRanks): readonly TowerVariantChoice[] {
  return [
    STANDARD_VARIANT_CHOICE,
    ...getUnlockedTowerVariants(tower, ranks).map(({ id, label, role, accent }) => ({ id, label, role, accent })),
  ]
}

/** Invalid, locked, and wrong-family ids all become the free Standard choice. */
export function normalizeTowerVariantSelection(
  tower: TowerKind,
  savedId: unknown,
  ranks: UpgradeRanks,
): TowerVariantId | undefined {
  if (typeof savedId !== 'string') return undefined
  const variant = getTowerVariant(tower, savedId)
  return variant && ownsResearchNode(ranks, variant) ? variant.id : undefined
}

/**
 * Keeps one researched choice per equipped tower. Standard choices are omitted,
 * which keeps old layouts compatible and makes Standard free by default.
 */
export function normalizeTowerVariantSelections(
  value: unknown,
  equippedTowers: readonly TowerKind[],
  ranks: UpgradeRanks,
): TowerVariantSelections {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const saved = value as Record<string, unknown>
  const normalized: TowerVariantSelections = {}
  for (const tower of equippedTowers) {
    const variantId = normalizeTowerVariantSelection(tower, saved[tower], ranks)
    if (variantId) normalized[tower] = variantId
  }
  return normalized
}

export function selectTowerVariant(
  current: TowerVariantSelections,
  tower: TowerKind,
  requestedId: TowerVariantId | null | undefined,
  ranks: UpgradeRanks,
): TowerVariantSelections {
  const next = { ...current }
  const normalized = normalizeTowerVariantSelection(tower, requestedId, ranks)
  if (normalized) next[tower] = normalized
  else delete next[tower]
  return next
}

export function isTowerVariantSelectionsEqual(left: TowerVariantSelections, right: TowerVariantSelections): boolean {
  return TOWER_KINDS.every((tower) => left[tower] === right[tower])
}
