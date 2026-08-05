import { describe, expect, it } from 'vitest'
import { addCombatVisual, MAX_CORPSE_VISUALS, MAX_TRANSIENT_VISUALS, projectileArcHeight } from './combat'

describe('combat visual pool', () => {
  it('keeps only the newest effects when a burst exceeds the cap', () => {
    const state = { visuals: [], nextVisualId: 1 } as Parameters<typeof addCombatVisual>[0]
    for (let index = 0; index < MAX_TRANSIENT_VISUALS + 20; index += 1) {
      addCombatVisual(state, 'impact', { x: index, z: 0 }, 1)
    }
    expect(state.visuals).toHaveLength(MAX_TRANSIENT_VISUALS)
    expect(state.visuals[0].x).toBe(20)
    expect(state.visuals.at(-1)?.x).toBe(MAX_TRANSIENT_VISUALS + 19)
  })

  it('keeps corpse history when transient sparks are saturated', () => {
    const state = { visuals: [], nextVisualId: 1 } as Parameters<typeof addCombatVisual>[0]
    for (let index = 0; index < MAX_CORPSE_VISUALS; index += 1) addCombatVisual(state, 'death', { x: index, z: 0 }, 10)
    for (let index = 0; index < MAX_TRANSIENT_VISUALS * 2; index += 1) addCombatVisual(state, 'impact', { x: index, z: 1 }, 1)
    expect(state.visuals.filter((visual) => visual.kind === 'death')).toHaveLength(MAX_CORPSE_VISUALS)
    expect(state.visuals.filter((visual) => visual.kind === 'impact')).toHaveLength(MAX_TRANSIENT_VISUALS)
  })

  it('gives heavy projectiles distinct readable arcs', () => {
    expect(projectileArcHeight('mortar', 6)).toBeGreaterThan(projectileArcHeight('rocket', 6))
    expect(projectileArcHeight('rocket', 6)).toBeGreaterThan(projectileArcHeight('cannon', 6))
    expect(projectileArcHeight('gunner', 6)).toBe(0)
  })
})
