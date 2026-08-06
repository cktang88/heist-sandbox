import type { EnemyStatus } from './combat'

export type EnemyStatusVisual = 'burn' | 'slow' | 'freeze' | 'stun' | 'brittle' | 'armorBreak'

export function hasEnemyStatusVisual(status: EnemyStatus, visual: EnemyStatusVisual): boolean {
  if (visual === 'burn') return status.burnRemaining > 0
  if (visual === 'slow') return status.slowRemaining > 0
  if (visual === 'freeze') return status.freezeRemaining > 0
  if (visual === 'stun') return status.stunRemaining > 0
  if (visual === 'brittle') return status.brittleRemaining > 0
  return status.armorBreakRemaining > 0
}

/** Pure status-to-shape mapping shared by rendering and audit tests. */
export function getEnemyStatusVisuals(status: EnemyStatus): EnemyStatusVisual[] {
  const visuals: EnemyStatusVisual[] = []
  for (const visual of ['burn', 'slow', 'freeze', 'stun', 'brittle', 'armorBreak'] as const) {
    if (hasEnemyStatusVisual(status, visual)) visuals.push(visual)
  }
  return visuals
}

/** Applies one long-lived status for the unranked visual-audit devtool. */
export function applyStatusVisualPreview(status: EnemyStatus, visual: EnemyStatusVisual, duration = 12): void {
  if (visual === 'burn') { status.burnRemaining = duration; status.burnDamagePerSecond = 0 }
  else if (visual === 'slow') { status.slowRemaining = duration; status.slowMultiplier = 0.35 }
  else if (visual === 'freeze') status.freezeRemaining = duration
  else if (visual === 'stun') status.stunRemaining = duration
  else if (visual === 'brittle') status.brittleRemaining = duration
  else { status.armorBreakRemaining = duration; status.armorBreakAmount = 0.35 }
}
