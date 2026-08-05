import { describe, expect, it } from 'vitest'
import { createBaseGameRules, DEFAULT_TUNING } from './config'
import { calculateDamage, createEmptyDamageBySource, isAttackInFront, recordDamageCredit } from './damageSources'

const target = {
  kind: 'shieldbearer' as const, x: 0, z: 0, health: 20, facingX: -1, facingZ: 0,
  status: { armorBreakRemaining: 0, armorBreakAmount: 0, brittleRemaining: 0 },
}

describe('damage resolution and accounting', () => {
  it('keeps frontal defense and resistance math independent from combat mutation', () => {
    const rules = createBaseGameRules(DEFAULT_TUNING)
    expect(isAttackInFront(target, { x: -2, z: 0 })).toBe(true)
    expect(calculateDamage(target, 10, 'ballistic', rules, false, { x: -2, z: 0 })).toBeLessThan(10)
    expect(calculateDamage(target, 10, 'ballistic', rules, true, { x: -2, z: 0 })).toBe(10)
  })

  it('credits tower and source reports without counting overkill', () => {
    const byTower = { gunner: 0, heavyGun: 0, cannon: 0, rocket: 0, flamethrower: 0, cryo: 0, tesla: 0, laser: 0, mortar: 0, support: 0 }
    const bySource = createEmptyDamageBySource()
    recordDamageCredit(byTower, bySource, { tower: 'gunner' }, 30, 20)
    expect(byTower.gunner).toBe(20)
    expect(bySource.gunner).toBe(20)
  })
})
