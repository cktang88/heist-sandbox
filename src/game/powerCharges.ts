import type { ActivePowerKind, GameRules } from './types'

export type PowerChargeState = Record<ActivePowerKind, number | null>

export function createRunPowerCharges(rules: Pick<GameRules, 'powerCharges'>): PowerChargeState {
  return { ...rules.powerCharges }
}

export function hasPowerCharge(charges: PowerChargeState, power: ActivePowerKind): boolean {
  return charges[power] === null || charges[power] > 0
}

export function consumePowerCharge(charges: PowerChargeState, power: ActivePowerKind): PowerChargeState {
  const remaining = charges[power]
  return remaining === null || remaining <= 0 ? charges : { ...charges, [power]: remaining - 1 }
}
