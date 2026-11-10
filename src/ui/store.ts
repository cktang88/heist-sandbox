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
