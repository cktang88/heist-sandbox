import { capitalise, chooserFor, clock, count, minutesIn, type Chooser } from './choose'
import { highlightsOf } from './highlights'
import { CONDITION_WORDS, ENTRY_WORDS } from './phrases'
import type { HeistRecord } from './record'
import { candidates, type Candidate } from './sentences'
import { headlineOf, siteWord, styleOf, verdictOf, type Style } from './verdict'

/**
 * The end-of-heist debrief: a headline, a short story in plain past tense (an opening, the most interesting moments
 * in order, an ending), a verdict on the style, the numbers and a few highlights. A pure function of the record.
 */

export type Debrief = {
  headline: string
  dateline: string
  story: string[]
  verdict: { style: Style; word: string; line: string }
  numbers: { label: string; value: string }[]
  highlights: string[]
  outcome: HeistRecord['outcome']
  briefing: string[]
}

const MAX_SENTENCES = 12
const MIN_SENTENCES = 6

export function composeDebrief(record: HeistRecord): Debrief {
  const choose = chooserFor(record)
  const style = styleOf(record)
  return {
    headline: headlineOf(record, style, choose),
    dateline: `${siteWord(record.site).replace(/^the /, '').toUpperCase()} · ${clock(record.seconds)} ON SITE`,
    story: storyOf(record, choose),
    verdict: verdictOf(record, style, choose),
    numbers: numbersOf(record),
    highlights: highlightsOf(record),
    outcome: record.outcome,
    briefing: record.briefing,
  }
}

export function storyOf(record: HeistRecord, choose: Chooser): string[] {
  const entered = record.beats.find((beat) => beat.kind === 'entered')
  const entry = entryLine(record, choose)
  const opening: Candidate[] = entry && entered ? [{ t: entered.t, score: 0, text: entry, place: entered.place }] : []
  const room = MAX_SENTENCES - opening.length - 2
  const middle = [...candidates(record, choose), ...tollOf(record)]
    .sort((a, b) => b.score - a.score || a.t - b.t)
    .slice(0, room)
    .sort((a, b) => a.t - b.t)
  const told = settleTimes(samePlaces([...opening, ...middle]), choose)
  const fill = fillers(record).filter((line) => !told.includes(line))
  while (told.length + 2 < MIN_SENTENCES && fill.length > 0) told.push(fill.shift()!)
  return [openingLine(record, choose), ...told, endingLine(record, choose)]
}

/** A place named in the sentence before is "there", or just "the office", the second time round. */
function samePlaces(sentences: Candidate[]): Candidate[] {
  let previous: string | undefined
  return sentences.map((sentence) => {
    const place = sentence.place
    let text = sentence.text
    if (place && place === previous) text = text.replace(` in ${place}`, ' there').split(place).join(shortPlace(place))
    previous = place ?? previous
    return { ...sentence, text }
  })
}

export function shortPlace(place: string): string {
  const match = place.match(/^the (?:\S+-floor |basement )?(.+?)(?: on basement level \d+)? of the [\w ]+$/) ?? place.match(/^the \w+'s basement (.+)$/)
  return match ? `the ${match[1]}` : place
}

/**
 * Fills the time markers: a time phrase only where the clock has moved on to a new minute since the last one said,
 * so the story does not open every sentence with "a minute in".
 */
function settleTimes(sentences: Candidate[], choose: Chooser): string[] {
  let said = -1
  return sentences.map(({ t, text }) => {
    const minute = Math.floor(t / 60)
    const fresh = minute !== said && (text.includes('{When}') || text.includes('{when}'))
    if (fresh) said = minute
    const phrase = whenPhrase(t, choose)
    if (fresh) return text.replace('{When}', capitalise(phrase)).replace('{when}', phrase)
    return capitalise(text.replace('{When}, ', '').replace(' {when}', ''))
  })
}

function whenPhrase(t: number, choose: Chooser): string {
  if (t < 60) return choose(`when-${Math.floor(t)}`, ['within the first minute', 'moments after landing', 'almost at once'])
  return choose(`when-${Math.floor(t)}`, [minutesIn(t), `at ${clock(t)}`])
}

function openingLine(record: HeistRecord, choose: Chooser): string {
  const words = record.conditions.map((id) => CONDITION_WORDS[id])
  const night = words.length === 0 ? choose('night', ['Shortly after midnight,', 'In the small hours,', 'Under a moonless sky,'])
    : `On a night of ${words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`},`
  const landed = record.beats.find((beat) => beat.kind === 'landed')
  const site = siteWord(record.site)
  if (!landed) return `${night} a lone operative slipped into ${site}.`
  return choose('open', [`${night} a lone operative parachuted onto ${landed.place}.`, `${night} a single figure drifted down out of the dark and landed on ${landed.place}.`])
}

function entryLine(record: HeistRecord, choose: Chooser): string | null {
  const entered = record.beats.find((beat) => beat.kind === 'entered')
  if (!entered) return null
  if (entered.detail === 'sewer' && /sewer|tunnels/.test(entered.place)) return '{When}, the intruder went in underground, through the sewer.'
  const how = choose('entry', ENTRY_WORDS[entered.detail ?? 'open'] ?? ENTRY_WORDS.open)
  return `{When}, the intruder ${how} ${entered.place}.`
}

function endingLine(record: HeistRecord, choose: Chooser): string {
  const time = clock(record.seconds)
  if (record.outcome === 'won') {
    return choose('end-won', [`At ${time} the intruder reached the van with the gold case and was gone.`, `${time} after the drop, the van pulled away with the case aboard.`, `The intruder walked out to the van at ${time}, case in hand.`])
  }
  if (record.outcome === 'dead') {
    const end = record.beats.find((beat) => beat.kind === 'died')
    const where = end?.place ? ` in ${end.place}` : ''
    return record.carrying ? `It ended${where} at ${time}: the intruder fell with the case in hand.` : `It ended${where} at ${time}, with the case still out of reach.`
  }
  return 'The night is not over yet.'
}

/** The count of the fallen, told near the end of a violent night. */
function tollOf(record: HeistRecord): Candidate[] {
  const { killed, knockedOut } = record.numbers
  if (killed + knockedOut < 3) return []
  const parts = [killed > 0 ? `${count(killed, 'guard')} dead` : null, knockedOut > 0 ? `${count(knockedOut, 'guard')} knocked out` : null].filter(Boolean)
  return [{ t: record.seconds - 0.5, score: 5, text: `By the end there were ${parts.join(' and ')}.` }]
}

/** True statements for a night with too little to tell. */
function fillers(record: HeistRecord): string[] {
  const n = record.numbers
  const lines: string[] = []
  if (n.seen === 0) lines.push('No guard so much as glimpsed the intruder.')
  if (n.peakLevel === 0) lines.push('Not one alarm was raised; the radio log reads "all quiet" from start to finish.')
  if (n.killed === 0 && n.knockedOut === 0) lines.push('Not a single guard was hurt.')
  if (n.clues > 0) lines.push(`Along the way the intruder picked up ${count(n.clues, 'clue')} about where the case was kept.`)
  if (record.outcome === 'won') lines.push(`The whole job took ${clock(record.seconds)}.`)
  return lines
}

function numbersOf(record: HeistRecord): { label: string; value: string }[] {
  const n = record.numbers
  return [
    { label: 'Time', value: clock(record.seconds) },
    { label: 'Seen', value: String(n.seen) },
    { label: 'Alarms', value: String(n.alarms) },
    { label: 'Knocked out', value: String(n.knockedOut) },
    { label: 'Killed', value: String(n.killed) },
    { label: 'Destroyed', value: `${n.tilesDestroyed} tiles` },
    { label: 'Loot', value: record.outcome === 'won' ? 'Gold case' : record.carrying ? 'Dropped' : 'None' },
  ]
}
