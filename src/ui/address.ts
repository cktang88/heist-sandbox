import { effectiveSettings, paramsFor, type Look, type Settings } from './settings'
import { loadSettings, saveSettings } from './store'

/** The address is where the game reads its start-up options; these helpers keep it in step with the heist. */

/** The settings in effect now: stored ones, with anything the address gives explicitly on top. */
export function currentSettings(): Settings {
  return effectiveSettings(loadSettings(), new URLSearchParams(location.search))
}

export function randomSeed(): number {
  return 1 + Math.floor(Math.random() * 999_999_999)
}

export function currentSeed(): number {
  return Number(new URLSearchParams(location.search).get('seed')) || 0
}

/** Records the heist's seed in the address without reloading, so a reload or a shared link replays it. */
export function writeSeed(seed: number): void {
  const params = new URLSearchParams(location.search)
  params.set('seed', String(seed))
  history.replaceState(history.state, '', `${location.pathname}?${params.toString()}${location.hash}`)
}

/** Saves the settings and restarts the page with them written into the address (same seed, other parameters kept). */
export function reloadWith(settings: Settings, seed = currentSeed()): void {
  saveSettings(settings)
  const params = paramsFor(settings, new URLSearchParams(location.search))
  if (seed > 0) params.set('seed', String(seed))
  location.replace(`${location.pathname}?${params.toString()}${location.hash}`)
}

/**
 * Switches the art style. The renderer only reads `?look=` at start-up for now, so this reloads;
 * once it has a live setter, call that here instead and the menus need not change.
 */
export function applyLook(look: Look): void {
  reloadWith({ ...currentSettings(), look })
}
