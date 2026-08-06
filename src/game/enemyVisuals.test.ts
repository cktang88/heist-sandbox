import { describe, expect, it } from 'vitest'
import { ENEMY_VISUALS } from './enemyVisuals'

describe('enemy visual identity', () => {
  it('gives every enemy role a unique silhouette signature', () => {
    const visuals = Object.values(ENEMY_VISUALS)
    expect(visuals).toHaveLength(10)
    expect(new Set(visuals.map((visual) => visual.identity)).size).toBe(visuals.length)
    expect(visuals.every((visual) => visual.scale > 0)).toBe(true)
  })
})
