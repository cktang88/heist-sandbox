import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, loadSettings } from './settings'

describe('settings persistence', () => {
  it('uses safe defaults for missing data', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => null } })
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps numeric settings and preserves valid toggles', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ masterVolume: 9, effectsVolume: -2, musicVolume: 0.4, uiScale: 4, reducedFlashes: true, screenShake: false, pauseOnBlur: false, corpseDensity: 'high' }) } })
    expect(loadSettings()).toMatchObject({ masterVolume: 1, effectsVolume: 0, musicVolume: 0.4, uiScale: 1.25, reducedFlashes: true, screenShake: false, pauseOnBlur: false, corpseDensity: 'high' })
  })

  it('adds screen shake safely to old saved settings', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ reducedFlashes: true }) } })
    expect(loadSettings().screenShake).toBe(true)
    expect(loadSettings().corpseDensity).toBe('low')
  })

  it('rejects unknown corpse density values during migration', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => JSON.stringify({ corpseDensity: 'maximum' }) } })
    expect(loadSettings().corpseDensity).toBe('low')
  })
})
