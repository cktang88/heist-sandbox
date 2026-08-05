import type { Placement, Point, TargetingRule } from './types'

export function removeSetupPlacement(placements: readonly Placement[], id: number): Placement[] {
  return placements.filter((placement) => placement.id !== id)
}

export function beginPlacementMove(placements: readonly Placement[], id: number): { placements: Placement[]; held: Placement } | null {
  const held = placements.find((placement) => placement.id === id)
  if (!held || held.temporary) return null
  return { placements: removeSetupPlacement(placements, id), held }
}

export function placeMovedPlacement(placements: readonly Placement[], held: Placement, point: Point): Placement[] {
  return [...placements, { ...held, ...point }]
}

export function cancelPlacementMove(placements: readonly Placement[], held: Placement | null): Placement[] {
  if (!held || placements.some((placement) => placement.id === held.id)) return [...placements]
  return [...placements, held]
}

export function rotateWallPlacement(placement: Placement): Placement {
  if (placement.kind !== 'wall') return placement
  return { ...placement, rotation: normalizeRotation((placement.rotation ?? 0) + Math.PI / 2) }
}

export function setPlacementTargeting(placements: readonly Placement[], id: number, targetingRule: TargetingRule): Placement[] {
  return placements.map((placement) => placement.id === id && placement.kind !== 'wall'
    ? { ...placement, targetingRule }
    : placement)
}

export function getPlacementTargeting(placement: Placement): TargetingRule {
  return placement.targetingRule ?? 'closest'
}

function normalizeRotation(rotation: number): number {
  const fullTurn = Math.PI * 2
  return ((rotation % fullTurn) + fullTurn) % fullTurn
}
