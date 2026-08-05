import { describe, expect, it } from 'vitest'
import { DEFAULT_TUNING } from './config'
import { consumePowerCharge, createRunPowerCharges, hasPowerCharge } from './powerCharges'
import { deriveGameRules } from './upgrades'

describe('per-run power charges', () => {
  it('spends finite charges without changing unlimited powers', () => {
    const initial = createRunPowerCharges(deriveGameRules(DEFAULT_TUNING, {}))
    const spentRepair = consumePowerCharge(initial, 'repair')
    expect(spentRepair.repair).toBe(0)
    expect(hasPowerCharge(spentRepair, 'repair')).toBe(false)
    expect(consumePowerCharge(spentRepair, 'barrage')).toBe(spentRepair)
  })

  it('creates a fresh charge set for every run', () => {
    const rules = deriveGameRules(DEFAULT_TUNING, { 'command-06': 2 })
    const firstRun = consumePowerCharge(createRunPowerCharges(rules), 'repair')
    expect(firstRun.repair).toBe(1)
    expect(createRunPowerCharges(rules).repair).toBe(2)
  })
})
