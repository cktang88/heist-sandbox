import { describe, expect, it } from 'vitest'
import { heardAt } from './soundFalloff'

describe('how far sounds carry', () => {
  it('plays a footstep beside the listener and drops it a room away', () => {
    expect(heardAt('footstep', 1, false)!.loudness).toBeGreaterThan(0.8)
    expect(heardAt('footstep', 14, false)).toBeNull()
  })

  it('carries gunfire much further than footsteps, fading with distance', () => {
    const close = heardAt('rifle', 5, false)!.loudness
    const far = heardAt('rifle', 40, false)!.loudness
    expect(close).toBeGreaterThan(far * 4)
    expect(heardAt('rifle', 70, false)).toBeNull()
  })

  it('makes a sound behind a wall quieter and muffled', () => {
    const open = heardAt('door', 5, false)!
    const walled = heardAt('door', 5, true)!
    expect(walled.loudness).toBeLessThan(open.loudness * 0.5)
    expect(walled.muffled).toBe(true)
    expect(open.muffled).toBe(false)
  })
})
