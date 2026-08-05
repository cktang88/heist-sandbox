import { describe, expect, it } from 'vitest'
import { addCombatVisual, MAX_COMBAT_VISUALS } from './combat'

describe('combat visual pool', () => {
  it('keeps only the newest effects when a burst exceeds the cap', () => {
    const state = { visuals: [], nextVisualId: 1 } as Parameters<typeof addCombatVisual>[0]
    for (let index = 0; index < MAX_COMBAT_VISUALS + 20; index += 1) {
      addCombatVisual(state, 'impact', { x: index, z: 0 }, 1)
    }
    expect(state.visuals).toHaveLength(MAX_COMBAT_VISUALS)
    expect(state.visuals[0].x).toBe(20)
    expect(state.visuals.at(-1)?.x).toBe(MAX_COMBAT_VISUALS + 19)
  })
})
