import type { Debrief } from '../game/chronicle/chronicle'

/**
 * The last few debriefs, kept in browser storage so the pause menu can show past heists. Storage may be missing or
 * refuse access (private windows, blocked site data): then the list is just empty.
 */

export type PastHeist = { debrief: Debrief; seed: number; site: string; when: string }

const STORAGE_KEY = 'smash-and-grab.debriefs'
const KEEP = 8

export function pastHeists(): PastHeist[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isPastHeist) : []
  } catch {
    return []
  }
}

export function rememberHeist(entry: PastHeist): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...pastHeists()].slice(0, KEEP)))
  } catch {
    // Nothing to do: the debrief still shows, it just is not kept.
  }
}

function isPastHeist(value: unknown): value is PastHeist {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<PastHeist>
  return typeof entry.seed === 'number' && typeof entry.site === 'string' && typeof entry.when === 'string'
    && typeof entry.debrief?.headline === 'string' && Array.isArray(entry.debrief.story) && Array.isArray(entry.debrief.numbers)
}
