import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, effectiveSettings, needsReload, paramsFor, parseSeed, parseSettings, serializeSettings, startupParams } from './settings'

describe('stored settings', () => {
  it('fall back to defaults when nothing is stored or the text is broken', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('[1,2]')).toEqual(DEFAULT_SETTINGS)
  })

  it('keep valid fields and replace invalid ones one by one', () => {
    const read = parseSettings(JSON.stringify({ look: 'pixel', quality: 'ultra', volume: 3, muted: 'yes', shake: false }))
    expect(read).toEqual({ ...DEFAULT_SETTINGS, look: 'pixel', volume: 1, shake: false })
  })

  it('survive a round trip', () => {
    const settings = { ...DEFAULT_SETTINGS, look: 'paint' as const, site: 'outpost' as const, volume: 0.25, autoSlowmo: false }
    expect(parseSettings(serializeSettings(settings))).toEqual(settings)
  })
})

describe('settings and the address', () => {
  const stored = { ...DEFAULT_SETTINGS, look: 'sketch' as const, quality: 'low' as const, site: 'outpost' as const }

  it('an explicit parameter wins over a stored setting', () => {
    const params = new URLSearchParams('look=pixel&seed=7')
    expect(effectiveSettings(stored, params).look).toBe('pixel')
    expect(startupParams(stored, params).get('look')).toBe('pixel')
  })

  it('stored settings fill in parameters the address leaves out, and other parameters are kept', () => {
    const params = startupParams(stored, new URLSearchParams('seed=7'))
    expect(params.get('seed')).toBe('7')
    expect(params.get('quality')).toBe('low')
    expect(params.get('site')).toBe('outpost')
    expect(params.has('render')).toBe(false)
  })

  it('an unknown parameter value is ignored', () => {
    expect(effectiveSettings(stored, new URLSearchParams('look=neon')).look).toBe('sketch')
  })

  it('choosing settings writes them into the address and removes defaults', () => {
    const chosen = { ...DEFAULT_SETTINGS, view: '2d' as const }
    const params = paramsFor(chosen, new URLSearchParams('seed=3&look=pixel&quality=low'))
    expect(params.toString()).toBe('seed=3&render=2d')
  })

  it('only address-backed settings need a reload', () => {
    expect(needsReload(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, volume: 0.1, shake: false })).toBe(false)
    expect(needsReload(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, look: 'sketch' })).toBe(true)
  })
})

describe('typed seeds', () => {
  it('accept whole numbers from 1 up', () => {
    expect(parseSeed(' 42 ')).toBe(42)
    expect(parseSeed('0')).toBeNull()
    expect(parseSeed('-3')).toBeNull()
    expect(parseSeed('1.5')).toBeNull()
    expect(parseSeed('abc')).toBeNull()
  })
})
