import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOADOUT } from '../game/loadout'
import { DEFAULT_SETTINGS } from './settings'
import { loadLoadout, loadSettings, saveLoadout } from './store'

/** Storage as a private window can give it: every read and write refused. */
const refused = {
  getItem: () => { throw new DOMException('denied', 'SecurityError') },
  setItem: () => { throw new DOMException('denied', 'QuotaExceededError') },
  removeItem: () => undefined,
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('browser storage that refuses access', () => {
  it('falls back to the default settings', () => {
    vi.stubGlobal('localStorage', refused)
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('still remembers the loadout for the next heist of this visit', () => {
    vi.stubGlobal('localStorage', refused)
    expect(loadLoadout()).toEqual(DEFAULT_LOADOUT)
    saveLoadout({ primary: 'sniper', gadgets: ['smoke', 'rope'] })
    expect(loadLoadout()).toEqual({ primary: 'sniper', gadgets: ['smoke', 'rope'] })
  })
})
