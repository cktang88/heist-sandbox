import type { Rng } from '../rng'
import type { ClueFilter, Detail, Place, PlaceKind } from './types'

/** Turning a place into what someone would actually say about it, and a clue back into a short log line. */

const BAND_STOREYS = 5
const BASEMENTS = { min: -9, max: -1 }

const KIND_WORDS: Record<PlaceKind, string> = {
  vault: 'the vault', safe: 'a safe in an executive office', lab: 'a lab', storage: 'a storage cage', armory: 'the armoury',
}

/** What a source says about `place` at a level of detail. Every claim is something the place really has. */
export function filterFor(place: Place, detail: Detail, rng: Rng): ClueFilter {
  const building = place.building
  switch (detail) {
    case 'building':
      return { building }
    case 'band':
      return { building, storeys: bandAround(place.storey, rng) }
    case 'side':
      return { building, side: place.side }
    case 'kind':
      return { building, kind: place.kind }
    case 'room':
      return { building, storeys: { min: place.storey, max: place.storey }, side: place.side, kind: place.kind, place: place.id }
  }
}

/** A run of storeys that holds this one, not centred on it, so the band does not give the floor away. */
function bandAround(storey: number, rng: Rng): { min: number; max: number } {
  if (storey < 0) return BASEMENTS
  const min = Math.max(0, storey - Math.floor(rng() * BAND_STOREYS))
  return { min, max: min + BAND_STOREYS - 1 }
}

export function matches(filter: ClueFilter, place: Place): boolean {
  if (filter.place !== undefined) return filter.place === place.id
  if (filter.building !== place.building) return false
  if (filter.storeys && (place.storey < filter.storeys.min || place.storey > filter.storeys.max)) return false
  if (filter.side && filter.side !== place.side) return false
  return !filter.kind || filter.kind === place.kind
}

function storeyWords(storeys: { min: number; max: number }): string {
  if (storeys.max < 0) return storeys.min === storeys.max ? `basement ${-storeys.min}` : 'the basements'
  if (storeys.min === storeys.max) return storeys.min === 0 ? 'ground floor' : `floor ${storeys.min}`
  return `floors ${storeys.min}-${storeys.max}`
}

/** The log line: "tower · floors 18-22 · east wing · a lab". */
export function describeFilter(filter: ClueFilter): string {
  const parts = [`the ${filter.building}`]
  if (filter.storeys) parts.push(storeyWords(filter.storeys))
  if (filter.side) parts.push(`${filter.side} wing`)
  if (filter.kind) parts.push(KIND_WORDS[filter.kind])
  return parts.join(' · ')
}

/** How the person sounds: guessing (a rookie who does not really know), plain, or grudging (a veteran giving it up). */
export type Voice = 'guessing' | 'plain' | 'grudging'

/** What a person says out loud when they give the clue up. */
export function spokenLine(filter: ClueFilter, voice: Voice): string {
  const building = `the ${filter.building}`
  let line: string
  if (filter.place !== undefined && filter.storeys && filter.kind) line = `${capital(KIND_WORDS[filter.kind])}, ${storeyWords(filter.storeys)}, ${filter.side} side. That's where it is.`
  else if (filter.kind) line = `They keep it in ${KIND_WORDS[filter.kind]}. Somewhere in ${building}.`
  else if (filter.storeys) line = filter.storeys.max < 0 ? `Downstairs, ${building} basements. Deep down.` : `It's in ${building}, ${storeyWords(filter.storeys)}... somewhere up there, I swear.`
  else if (filter.side) line = `${capital(filter.side)} wing of ${building}. Don't know the floor.`
  else line = `It's in ${building}. That's all they tell us.`
  if (voice === 'guessing') return `I don't know! ${line.replace(/\.$/, '')}... maybe?`
  if (voice === 'grudging') return `...Fine. ${line}`
  return line
}

/** What a written source says, as the log and a caption show it. */
export function writtenLine(filter: ClueFilter, kind: 'roster' | 'manifest' | 'note'): string {
  const where = describeFilter(filter)
  if (kind === 'roster') return `Duty roster: extra guard posted at ${where}.`
  if (kind === 'manifest') return `Shipping manifest: "secure case" signed in at ${where}.`
  return `Note: "Package moved to ${where}. Keep it quiet."`
}

function capital(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
