import type { Beat } from '../types'
import { capitalise, count, type Chooser } from './choose'
import { CAUSE_WORDS, claimWords, downWords, EVENT_WORDS, sourceWords, VEHICLE_WORDS } from './phrases'
import type { HeistRecord } from './record'

/**
 * The middle of the story: each beat worth telling becomes a candidate sentence with a score for how interesting it
 * is (surprises, reversals and firsts score high; routine low). The story keeps the best and tells them in order.
 * `{When}` / `{when}` mark where a time phrase may go; the story fills in only those that move the clock on.
 */
export type Candidate = { t: number; score: number; text: string; place?: string }

export function candidates(record: HeistRecord, choose: Chooser): Candidate[] {
  const found: Candidate[] = []
  const add = (beat: Beat, score: number, text: string | null) => {
    if (text) found.push({ t: beat.t, score, text, place: beat.place || undefined })
  }
  const firstOf = (kind: Beat['kind']) => record.beats.find((beat) => beat.kind === kind)
  const firstTime = (beat: Beat) => firstOf(beat.kind) === beat
  const spotted = firstOf('spotted')
  if (spotted) add(spotted, 5, spottedLine(spotted, choose))
  const down = firstOf('down')
  if (down) add(down, 6, firstDownLine(down, choose))
  const body = firstOf('bodyFound')
  if (body) add(body, 5, choose('body', [`${capitalise(body.who ?? 'a guard')}'s body was found in ${body.place}.`, `It did not take long for someone to find ${body.who ?? 'a guard'} lying in ${body.place}.`]))
  const shot = firstOf('firstShot')
  if (shot && !down) add(shot, 4, `The first shot, from a ${shot.detail?.toLowerCase() ?? 'gun'}, rang out in ${shot.place}.`)
  for (const beat of record.beats) {
    switch (beat.kind) {
      case 'alert': if ((beat.n ?? 0) >= 3) add(beat, beat.n === 4 ? 6 : 7, alertLine(beat, choose)); break
      case 'clue': add(beat, beat.truth === false ? 6 : 3, clueLine(beat, choose)); break
      case 'caseMoved': add(beat, 7, choose('moved', [`With the alarm ringing, the guards moved the case to ${beat.place}, and every tip so far went stale.`, `The guards hurried the case off to ${beat.place}.`])); break
      case 'caseFound': add(beat, 9, caseLine(beat, choose)); break
      case 'hidden': add(beat, 6 + Math.min(4, (beat.n ?? 0) / 10), hiddenLine(beat, choose)); break
      case 'lowHealth': add(beat, 6, choose('low', [`Bleeding badly in ${beat.place}, the intruder kept moving.`, `By the time ${beat.place} was behind them, the intruder was down to the last of their strength.`])); break
      case 'nearMiss': add(beat, 3, `A round missed the intruder by a hand's width in ${beat.place}.`); break
      case 'explosion': add(beat, (beat.n ?? 0) <= 1 ? 6 : 4, (beat.n ?? 0) <= 1 ? `The first explosion shook ${beat.place} {when}.` : `Another blast tore through ${beat.place}.`); break
      case 'collapse': add(beat, 10, choose('collapse', [`Then a whole section of ${beat.place} came down.`, `With nothing left holding it up, ${beat.place} collapsed.`])); break
      case 'vehicle': add(beat, 5, `A ${VEHICLE_WORDS[beat.detail ?? ''] ?? 'vehicle'} went up in flames in ${beat.place}.`); break
      case 'fire': add(beat, 6, `Fire took hold in ${beat.place}${(beat.n ?? 0) >= 20 ? ` and spread until ${beat.n} tiles were burning at once` : ''}.`); break
      case 'surrender': add(beat, firstTime(beat) ? 5 : 2, choose(`gave-${beat.t}`, [`${capitalise(beat.who ?? 'a guard')} threw down his weapon and begged for his life.`, `${capitalise(beat.who ?? 'a guard')} gave up on the spot, hands in the air.`])); break
      case 'fled': add(beat, firstTime(beat) ? 4 : 1, `${capitalise(beat.who ?? 'a guard')} lost his nerve and ran.`); break
      case 'event': add(beat, beat.outcome ? 4 : 2, eventLine(beat)); break
      default: break
    }
  }
  return found
}

function spottedLine(beat: Beat, choose: Chooser): string {
  const who = beat.who ?? 'a guard'
  return choose('spotted', [`{When}, ${who} spotted the intruder in ${beat.place}.`, `${capitalise(who)} was the first to get a look at the intruder, in ${beat.place}.`])
}

function firstDownLine(beat: Beat, choose: Chooser): string {
  const who = beat.who ?? 'a guard'
  const how = downWords(beat.detail ?? '')
  return choose('first-down', [`The first to fall was ${who}, ${how} in ${beat.place}.`, `${capitalise(who)} was ${how} in ${beat.place}, the first of the night.`])
}

function alertLine(beat: Beat, choose: Chooser): string {
  const cause = CAUSE_WORDS[beat.detail ?? 'unknown'] ?? CAUSE_WORDS.unknown
  if (beat.n === 4) return choose('lockdown', [`{When}, the whole site was in lockdown.`, 'Then the site went into full lockdown.'])
  return choose('alarm', [`The alarm went up ${cause}.`, `{When}, the site went to full alarm ${cause}.`])
}

function clueLine(beat: Beat, choose: Chooser): string {
  const said = beat.detail ? claimWords(beat.detail) : 'somewhere on site'
  const from = sourceWords(beat.who ?? 'source')
  const base = choose(`clue-${beat.n}`, [`A tip from ${from} put the case in ${said}`, `${capitalise(from)} gave the case away: ${said}`])
  return beat.truth === false ? `${base}, but the tip was wrong.` : `${base}.`
}

function caseLine(beat: Beat, choose: Chooser): string {
  const where = beat.place
  if (beat.truth === true) return choose('found-right', [`The case was right where the clues said, in ${where}.`, `The gold case turned up in ${where}, exactly as the tips had it.`])
  if (beat.truth === false) return choose('found-wrong', [`The case turned up in ${where}, nowhere near where the clues pointed.`, `In the end the gold was in ${where}, not where anyone had said.`])
  return choose('found', [`The gold case was found in ${where}.`, `The case turned up in ${where}.`])
}

function hiddenLine(beat: Beat, choose: Chooser): string {
  const searchers = Number(beat.who ?? 1)
  const guards = count(searchers, 'guard')
  return choose(`hid-${beat.t}`, [
    `For ${beat.n} seconds the intruder stayed ${beat.detail ?? 'out of sight'} in ${beat.place} while ${guards} searched within a few steps, and was never found.`,
    `${capitalise(guards)} searched ${beat.place} for ${beat.n} seconds without spotting the intruder, ${beat.detail ?? 'out of sight'} the whole time.`,
  ])
}

function eventLine(beat: Beat): string | null {
  const what = EVENT_WORDS[beat.detail as keyof typeof EVENT_WORDS]
  if (!what) return null
  return `{When}, ${what}${beat.outcome ? `; ${beat.outcome}` : ''}.`
}
