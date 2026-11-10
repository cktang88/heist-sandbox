import { capitalise, clock, count } from './choose'
import type { HeistRecord } from './record'

/**
 * Two or three one-line highlights: the moments a player would tell a friend about. Each candidate has a score; the
 * best three that actually happened are kept.
 */

type Highlight = { score: number; text: string }

export function highlightsOf(record: HeistRecord): string[] {
  const n = record.numbers
  const found: Highlight[] = []
  const hides = record.beats.filter((beat) => beat.kind === 'hidden').sort((a, b) => (b.n ?? 0) - (a.n ?? 0))
  const best = hides[0]
  if (best) found.push({ score: 6 + (best.n ?? 0) / 8, text: `Stayed ${best.detail ?? 'hidden'} for ${best.n} seconds while ${count(Number(best.who ?? 1), 'guard')} searched ${best.place}` })
  if (record.outcome === 'won' && n.seen === 0) found.push({ score: 9, text: 'Never seen. Not once.' })
  if (record.outcome === 'won' && record.seconds < 300) found.push({ score: 7, text: `In and out in ${clock(record.seconds)}` })
  const downs = n.knockedOut + n.killed
  if (downs >= 3 && n.shots === 0) found.push({ score: 7, text: `Put ${count(downs, 'guard')} down without firing a shot` })
  if (n.killed >= 10) found.push({ score: 6, text: `${capitalise(count(n.killed, 'guard'))} killed` })
  if (n.collapses > 0) found.push({ score: 8, text: n.collapses === 1 ? 'Brought a section of building down' : `Brought down ${n.collapses} sections of building` })
  if (n.maxFire >= 30) found.push({ score: 6, text: `Started a fire that reached ${n.maxFire} burning tiles` })
  if (n.vehiclesLost > 0) found.push({ score: 4, text: `Wrecked ${count(n.vehiclesLost, 'vehicle')}` })
  const low = record.beats.find((beat) => beat.kind === 'lowHealth')
  if (low && record.outcome === 'won') found.push({ score: 8, text: `Escaped after nearly dying in ${low.place}` })
  if (n.surrendered >= 2) found.push({ score: 5, text: `${capitalise(count(n.surrendered, 'guard'))} surrendered` })
  const wrong = record.beats.find((beat) => beat.kind === 'caseFound' && beat.truth === false)
  if (wrong) found.push({ score: 6, text: `Found the case in ${wrong.place}, despite the clues` })
  const deal = record.beats.find((beat) => beat.kind === 'event' && beat.detail === 'deal' && beat.outcome)
  if (deal) found.push({ score: 5, text: `Took a deal from a guard who gave up: ${deal.outcome}` })
  if (n.explosions >= 5) found.push({ score: 4, text: `${capitalise(count(n.explosions, 'explosion'))}` })
  return found.sort((a, b) => b.score - a.score).slice(0, 3).map((highlight) => highlight.text)
}
