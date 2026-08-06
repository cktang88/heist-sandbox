import { describe, expect, it } from 'vitest'
import type { EnemyStatus } from './combat'
import { applyStatusVisualPreview, getEnemyStatusVisuals, type EnemyStatusVisual } from './statusVisuals'

const emptyStatus = (): EnemyStatus => ({
  burnRemaining: 0, burnDamagePerSecond: 0, slowRemaining: 0, slowMultiplier: 1,
  freezeCharge: 0, freezeRemaining: 0, stunRemaining: 0, brittleRemaining: 0,
  armorBreakRemaining: 0, armorBreakAmount: 0,
})

describe('enemy status visual identity', () => {
  const cases: readonly [keyof EnemyStatus, EnemyStatusVisual][] = [
    ['burnRemaining', 'burn'], ['slowRemaining', 'slow'], ['freezeRemaining', 'freeze'],
    ['stunRemaining', 'stun'], ['brittleRemaining', 'brittle'], ['armorBreakRemaining', 'armorBreak'],
  ]

  it.each(cases)('maps %s to a visible %s marker', (field, visual) => {
    const status = emptyStatus()
    Object.assign(status, { [field]: 1 })
    expect(getEnemyStatusVisuals(status)).toContain(visual)
  })

  it('preserves simultaneous statuses instead of hiding all but one', () => {
    const status = emptyStatus()
    status.burnRemaining = status.slowRemaining = status.brittleRemaining = 1
    expect(getEnemyStatusVisuals(status)).toEqual(['burn', 'slow', 'brittle'])
  })

  it.each(cases)('can seed %s through the visual-audit devtool', (_field, visual) => {
    const status = emptyStatus()
    applyStatusVisualPreview(status, visual)
    expect(getEnemyStatusVisuals(status)).toEqual([visual])
  })
})
