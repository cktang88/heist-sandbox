import { describe, expect, it } from 'vitest'
import { chooseVoices, heardAt, MAX_VOICES } from './soundFalloff'

describe('the mix', () => {
  it('starts only the loudest couple of one kind in a frame', () => {
    const hits = [0.2, 0.9, 0.5, 0.7].map((loudness) => ({ kind: 'impact' as const, loudness }))
    expect(chooseVoices(hits, MAX_VOICES).map((hit) => hit.loudness)).toEqual([0.9, 0.7])
  })

  it('never starts more sounds than there are free voices, loudest first', () => {
    const kinds = ['rifle', 'glass', 'door', 'kill', 'impact'] as const
    const many = kinds.map((kind, index) => ({ kind, loudness: index / 10 }))
    expect(chooseVoices(many, 2).map((sound) => sound.kind)).toEqual(['impact', 'kill'])
    expect(chooseVoices(many, 0)).toEqual([])
  })
})

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
