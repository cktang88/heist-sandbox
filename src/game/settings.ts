const SETTINGS_KEY = 'orcfall-command-settings'

export type GameSettings = {
  masterVolume: number
  effectsVolume: number
  musicVolume: number
  reducedFlashes: boolean
  screenShake: boolean
  uiScale: number
  pauseOnBlur: boolean
  corpseDensity: 'off' | 'low' | 'high'
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  effectsVolume: 0.9,
  musicVolume: 0.55,
  reducedFlashes: false,
  screenShake: true,
  uiScale: 1,
  pauseOnBlur: true,
  corpseDensity: 'low',
}

export function loadSettings(): GameSettings {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return DEFAULT_SETTINGS
    const value = parsed as Record<string, unknown>
    return {
      masterVolume: clamp(value.masterVolume, DEFAULT_SETTINGS.masterVolume),
      effectsVolume: clamp(value.effectsVolume, DEFAULT_SETTINGS.effectsVolume),
      musicVolume: clamp(value.musicVolume, DEFAULT_SETTINGS.musicVolume),
      reducedFlashes: typeof value.reducedFlashes === 'boolean' ? value.reducedFlashes : DEFAULT_SETTINGS.reducedFlashes,
      screenShake: typeof value.screenShake === 'boolean' ? value.screenShake : DEFAULT_SETTINGS.screenShake,
      uiScale: Math.min(1.25, Math.max(0.85, clamp(value.uiScale, DEFAULT_SETTINGS.uiScale, 1.25))),
      pauseOnBlur: typeof value.pauseOnBlur === 'boolean' ? value.pauseOnBlur : DEFAULT_SETTINGS.pauseOnBlur,
      corpseDensity: value.corpseDensity === 'off' || value.corpseDensity === 'low' || value.corpseDensity === 'high'
        ? value.corpseDensity : DEFAULT_SETTINGS.corpseDensity,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function storeSettings(settings: GameSettings): void {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

function clamp(value: unknown, fallback: number, max = 1): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : fallback
}
