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
    return parsePastHeists(localStorage.getItem(STORAGE_KEY))
  } catch {
    return []
  }
}

/** Stored text back to entries, dropping any the debrief screen could not draw (broken, or from an older version). */
export function parsePastHeists(text: string | null): PastHeist[] {
  try {
    const parsed: unknown = JSON.parse(text ?? '[]')
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

const STYLES: readonly Debrief['verdict']['style'][] = ['ghost', 'quiet', 'loud', 'catastrophe']
const OUTCOMES: readonly Debrief['outcome'][] = ['won', 'dead', 'playing']

const isText = (value: unknown): value is string => typeof value === 'string'
const isTextList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isText)

function isPastHeist(value: unknown): value is PastHeist {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Partial<PastHeist>
  return typeof entry.seed === 'number' && isText(entry.site) && isText(entry.when) && isDebrief(entry.debrief)
}

/** Every field the debrief screen reads, so a damaged entry is left out instead of breaking the list. */
function isDebrief(value: unknown): value is Debrief {
  if (typeof value !== 'object' || value === null) return false
  const debrief = value as Partial<Debrief>
  const verdict = debrief.verdict
  return isText(debrief.headline) && isText(debrief.dateline) && isTextList(debrief.story) && isTextList(debrief.highlights)
    && isTextList(debrief.briefing) && OUTCOMES.includes(debrief.outcome as Debrief['outcome'])
    && typeof verdict === 'object' && verdict !== null && STYLES.includes(verdict.style) && isText(verdict.word) && isText(verdict.line)
    && Array.isArray(debrief.numbers) && debrief.numbers.every((row) => typeof row === 'object' && row !== null && isText(row.label) && isText(row.value))
}
