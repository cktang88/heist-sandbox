import { describe, expect, it } from 'vitest'
import { fortressDamageStage } from './FortressDamageEffects'

describe('fortress damage presentation', () => {
  it('maps health to stable visual stages', () => {
    expect(fortressDamageStage(1)).toBe('intact')
    expect(fortressDamageStage(0.69)).toBe('worn')
    expect(fortressDamageStage(0.29)).toBe('critical')
    expect(fortressDamageStage(0)).toBe('ruined')
  })
})
