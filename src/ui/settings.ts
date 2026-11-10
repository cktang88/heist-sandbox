/**
 * The player's settings: what they are, their defaults, how they are read back from storage, and how they map
 * onto the address parameters the game already reads at start-up (`look`, `quality`, `render`, `site`).
 * Pure: no browser code, so it is tested directly.
 */

export const LOOKS = ['real', 'pixel', 'pixel-hd', 'sketch', 'paint'] as const
export const QUALITIES = ['auto', 'low', 'high'] as const
export const VIEWS = ['3d', '2d'] as const
export const SITES = ['complex', 'outpost'] as const

export type Look = (typeof LOOKS)[number]
export type Quality = (typeof QUALITIES)[number]
export type View = (typeof VIEWS)[number]
export type Site = (typeof SITES)[number]

export type Settings = {
  look: Look
  quality: Quality
  view: View
  site: Site
  /** Master volume, 0 to 1. */
  volume: number
  muted: boolean
  /** The short slow-motion bursts on big moments (being spotted, near misses, kills). Shift focus is separate. */
  autoSlowmo: boolean
  shake: boolean
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  look: 'pixel', quality: 'auto', view: '3d', site: 'complex', volume: 0.8, muted: false, autoSlowmo: true, shake: true,
}

export const STORAGE_KEY = 'smash-and-grab.settings'

/** What each choice is called on the settings screen. Typed by the value lists, so a new choice cannot go unnamed. */
export const CHOICE_LABELS: Record<Look | Quality | View | Site, string> = {
  real: 'Real', pixel: 'Pixel', 'pixel-hd': 'Pixel HD', sketch: 'Sketch', paint: 'Paint', auto: 'Auto', low: 'Low', high: 'High',
  '3d': '3D', '2d': '2D (fast)', complex: 'Complex', outpost: 'Outpost',
}

/** The settings that live in the address, each with its parameter name and the value meaning "leave it out". */
type UrlField = 'look' | 'quality' | 'view' | 'site'
const URL_FIELDS: readonly { field: UrlField; param: string; values: readonly string[] }[] = [
  { field: 'look', param: 'look', values: LOOKS },
  { field: 'quality', param: 'quality', values: QUALITIES },
  { field: 'view', param: 'render', values: VIEWS },
  { field: 'site', param: 'site', values: SITES },
]

function oneOf<T extends string>(values: readonly T[], value: unknown, fallback: T): T {
  return typeof value === 'string' && (values as readonly string[]).includes(value) ? (value as T) : fallback
}

function flag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function fraction(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback
}

/** Reads stored settings. Anything missing, unknown or broken falls back to its default, field by field. */
export function parseSettings(raw: string | null): Settings {
  let stored: Record<string, unknown> = {}
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) stored = parsed as Record<string, unknown>
  } catch {
    stored = {}
  }
  const d = DEFAULT_SETTINGS
  return {
    look: oneOf(LOOKS, stored.look, d.look),
    quality: oneOf(QUALITIES, stored.quality, d.quality),
    view: oneOf(VIEWS, stored.view, d.view),
    site: oneOf(SITES, stored.site, d.site),
    volume: fraction(stored.volume, d.volume),
    muted: flag(stored.muted, d.muted),
    autoSlowmo: flag(stored.autoSlowmo, d.autoSlowmo),
    shake: flag(stored.shake, d.shake),
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(settings)
}

/** The settings in effect: stored ones, overridden by any valid parameter written in the address. */
export function effectiveSettings(stored: Settings, params: URLSearchParams): Settings {
  const result = { ...stored }
  for (const { field, param, values } of URL_FIELDS) {
    const given = params.get(param)
    if (given !== null && values.includes(given)) Object.assign(result, { [field]: given })
  }
  return result
}

/**
 * The address to start with: stored settings are filled in for parameters the address does not already give,
 * so an explicit parameter always wins. Defaults are left out to keep the address short.
 */
export function startupParams(stored: Settings, params: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams(params)
  for (const { field, param } of URL_FIELDS) {
    if (!result.has(param) && stored[field] !== DEFAULT_SETTINGS[field]) result.set(param, stored[field])
  }
  return result
}

/** The address after choosing these settings: every address-backed setting is written (or removed if default). */
export function paramsFor(settings: Settings, params: URLSearchParams): URLSearchParams {
  const result = new URLSearchParams(params)
  for (const { field, param } of URL_FIELDS) {
    if (settings[field] === DEFAULT_SETTINGS[field]) result.delete(param)
    else result.set(param, settings[field])
  }
  return result
}

/** The settings that only take effect after the page reloads. */
export function needsReload(before: Settings, after: Settings): boolean {
  return URL_FIELDS.some(({ field }) => before[field] !== after[field])
}

/** A seed typed by the player: a whole number from 1 up, or null. */
export function parseSeed(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d{1,9}$/.test(trimmed)) return null
  const seed = Number(trimmed)
  return seed > 0 ? seed : null
}
