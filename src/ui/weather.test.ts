import { describe, expect, it } from 'vitest'
import { rainShare } from './weather'

describe('the rain over the view', () => {
  it('is heavy outside, faint in a room, and gone underground or on a dry night', () => {
    expect(rainShare(true, true, false)).toBeGreaterThan(rainShare(true, false, false))
    expect(rainShare(true, false, false)).toBeGreaterThan(0)
    expect(rainShare(true, false, true)).toBe(0)
    expect(rainShare(false, true, false)).toBe(0)
  })
})
