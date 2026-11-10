import type { Chooser } from './choose'
import type { HeistRecord } from './record'

/**
 * The style of the night in one word, and a line about it:
 *  ghost       never seen, nobody killed, the site never above unease;
 *  quiet       a hiccup at most: no alarm, no blast, a few guards down at most;
 *  loud        alarms, gunfire, bodies, but the place still stands;
 *  catastrophe storeys down, a site-wide blaze, or a massacre.
 */
export type Style = 'ghost' | 'quiet' | 'loud' | 'catastrophe'

export function styleOf(record: HeistRecord): Style {
  const n = record.numbers
  if (n.collapses > 0 || n.tilesDestroyed > 400 || n.killed >= 15 || n.maxFire >= 60) return 'catastrophe'
  if (n.seen === 0 && n.killed === 0 && n.peakLevel <= 1 && n.explosions === 0) return 'ghost'
  if (n.alarms === 0 && n.explosions === 0 && n.killed <= 3 && n.peakLevel <= 2) return 'quiet'
  return 'loud'
}

const STYLE_WORDS: Record<Style, string> = { ghost: 'Ghost', quiet: 'Quiet, with a hiccup', loud: 'Loud', catastrophe: 'Catastrophe' }

const VERDICTS: Record<Style, readonly string[]> = {
  ghost: ['In and out like smoke: nobody will believe it happened.', 'A textbook job. The guards are still on their rounds.', 'Not a single raised voice all night.'],
  quiet: ['Mostly clean. Somebody will be asking questions in the morning.', 'A quiet job with one loose thread.', 'Not perfect, but nobody called it in.'],
  loud: ['Subtle it was not.', 'The whole site knows. The case is still gone.', 'Noisy, messy, and effective.'],
  catastrophe: ['They will be sweeping up for weeks.', 'Less a heist than an act of war.', 'The insurers will want a word.'],
}

const DIED: readonly string[] = ['The job ended on the floor.', 'A bad night with no way home.', 'The house won this one.']

export function verdictOf(record: HeistRecord, style: Style, choose: Chooser): { style: Style; word: string; line: string } {
  const line = record.outcome === 'dead' ? choose('verdict-dead', DIED) : choose('verdict', VERDICTS[style])
  return { style, word: STYLE_WORDS[style], line }
}

/** "Blackmoor Complex" reads as "Blackmoor" in a headline. */
export function siteWord(site: string): string {
  const short = site.replace(/\s+(Complex|Site|Facility)$/i, '')
  return short.toLowerCase() === 'outpost' ? 'the Outpost' : short
}

export function headlineOf(record: HeistRecord, style: Style, choose: Chooser): string {
  const site = siteWord(record.site)
  const Site = site.charAt(0).toUpperCase() + site.slice(1)
  if (record.outcome === 'dead') {
    return record.carrying
      ? choose('head-dead-gold', [`So close: raider falls at ${site} with the gold in hand`, `Gold case recovered from fallen intruder at ${site}`])
      : choose('head-dead', [`Raid on ${site} ends in death`, `Intruder killed inside ${site}`, `${Site} holds: would-be thief dies in the attempt`])
  }
  const collapsed = record.beats.some((beat) => beat.kind === 'collapse')
  const tower = record.beats.find((beat) => beat.kind === 'collapse' || beat.kind === 'fire')?.place.match(/of the (\w+)$/)?.[1]
  switch (style) {
    case 'ghost':
      return choose('head-ghost', [`Nobody saw a thing: gold case vanishes from ${site}`, `${Site} guards swear nothing happened. The case says otherwise`, `Silent night at ${site} as gold walks out the door`])
    case 'quiet':
      return choose('head-quiet', [`Quiet job at ${site} leaves one loose end`, `Thief slips out of ${site} after a brief scare`, `Gold lifted from ${site}; guards "heard something"`])
    case 'loud':
      return choose('head-loud', [`Gunfire and alarms at ${site} as raider escapes with gold`, `${Site} locked down after armed raid`, `Shots, sirens and an empty vault at ${site}`])
    case 'catastrophe':
      if (collapsed) return choose('head-collapse', [`${Site} ${tower ?? 'complex'} gutted in midnight raid`, `Storeys brought down at ${site} in gold heist`])
      return choose('head-catastrophe', [`Blasts rip through ${site} in midnight raid`, `${Site} left burning after gold heist`, `Night of fire at ${site}`])
  }
}
