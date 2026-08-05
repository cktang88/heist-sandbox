import { describe, expect, it } from 'vitest'
import { corpseVisualLimit, newestVisualStart } from './CombatEffects'

describe('pooled combat effects', () => {
  it('keeps the newest entries when the projectile pool is saturated', () => {
    expect(newestVisualStart(10, 4)).toBe(6)
    expect(newestVisualStart(3, 4)).toBe(0)
    expect(newestVisualStart(3, 0)).toBe(3)
  })

  it('maps the saved corpse setting to bounded instance counts', () => {
    expect(corpseVisualLimit('off')).toBe(0)
    expect(corpseVisualLimit('low')).toBe(64)
    expect(corpseVisualLimit('high')).toBe(192)
  })
})
