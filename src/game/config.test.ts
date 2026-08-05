import { describe, expect, it } from 'vitest'
import { DEFAULT_TUNING, isOffensiveTowerKind } from './config'

describe('tower roles', () => {
  it('does not treat a support beacon as an offensive tower', () => {
    expect(isOffensiveTowerKind('support', DEFAULT_TUNING)).toBe(false)
    expect(isOffensiveTowerKind('gunner', DEFAULT_TUNING)).toBe(true)
  })
})
