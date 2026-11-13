import { LOADOUT_STORAGE_KEY, parseLoadout, serializeLoadout, type Loadout } from '../game/loadout'
import { DEFAULT_SETTINGS, parseSettings, serializeSettings, STORAGE_KEY, type Settings } from './settings'

/** Browser storage can be missing or refuse access (private windows, blocked site data): settings then just do not persist. */
export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSettings(settings))
  } catch {
    // Nothing to do: the setting still applies for this visit.
  }
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // As above.
  }
}

/** The loadout picked on the drop planner, kept for the next heist the same way. */
export function loadLoadout(): Loadout {
  try {
    return parseLoadout(localStorage.getItem(LOADOUT_STORAGE_KEY))
  } catch {
    return parseLoadout(null)
  }
}

export function saveLoadout(loadout: Loadout): void {
  try {
    localStorage.setItem(LOADOUT_STORAGE_KEY, serializeLoadout(loadout))
  } catch {
    // The loadout still applies to this heist.
  }
}
