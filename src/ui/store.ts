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

/**
 * The last loadout saved during this visit. Where storage refuses it, the next heist's planner still opens on it:
 * the help screen promises the last loadout is remembered, and repacking after every heist broke that promise.
 */
let visitLoadout: string | null = null

/** The loadout picked on the drop planner, kept for the next heist the same way. */
export function loadLoadout(): Loadout {
  try {
    return parseLoadout(visitLoadout ?? localStorage.getItem(LOADOUT_STORAGE_KEY))
  } catch {
    return parseLoadout(visitLoadout)
  }
}

export function saveLoadout(loadout: Loadout): void {
  visitLoadout = serializeLoadout(loadout)
  try {
    localStorage.setItem(LOADOUT_STORAGE_KEY, visitLoadout)
  } catch {
    // The loadout still applies to this heist, and to the next ones of this visit.
  }
}
