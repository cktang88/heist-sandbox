import { describe, expect, it } from 'vitest'
import { advanceWallRecharge } from './wallRecharge'

describe('temporary wall recharge', () => {
  it('counts down in simulation time and stops while paused', () => {
    expect(advanceWallRecharge(6, 1, 1, false)).toBe(5)
    expect(advanceWallRecharge(6, 1, 2, false)).toBe(4)
    expect(advanceWallRecharge(6, 10, 2, false)).toBe(0)
    expect(advanceWallRecharge(6, 1, 2, true)).toBe(6)
  })
})
