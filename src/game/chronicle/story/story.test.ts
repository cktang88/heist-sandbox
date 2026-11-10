import { describe, expect, it } from 'vitest'
import type { Beat } from '../types'
import { composeDebrief } from './debrief'
import type { HeistRecord } from './record'

const NUMBERS: HeistRecord['numbers'] = {
  seen: 0, seenBy: 0, alarms: 0, peakLevel: 0, knockedOut: 0, killed: 0, tied: 0, surrendered: 0, tilesDestroyed: 0,
  explosions: 0, shots: 0, collapses: 0, vehiclesLost: 0, maxFire: 0, closeCalls: 0, clues: 0,
}

function record(beats: Beat[], numbers: Partial<HeistRecord['numbers']> = {}, extra: Partial<HeistRecord> = {}): HeistRecord {
  const seconds = beats.at(-1)?.t ?? 100
  return { site: 'Blackmoor Complex', outcome: 'won', seconds, beats, conditions: [], briefing: [], carrying: true, numbers: { ...NUMBERS, ...numbers }, ...extra }
}

const beat = (kind: Beat['kind'], t: number, place: string, extra: Partial<Beat> = {}): Beat => ({ kind, t, place, ...extra })

const GHOST = record([
  beat('tonight', 0, '', { detail: 'rain' }),
  beat('landed', 41, 'the depot roof'),
  beat('entered', 63, 'the 3rd-floor storage of the depot', { detail: 'window' }),
  beat('clue', 120, 'the 3rd-floor storage of the depot', { who: 'notice board', detail: 'the tower · a lab', truth: true, n: 0 }),
  beat('hidden', 150, 'the 9th-floor office of the tower', { n: 41, who: '4', detail: 'crouched behind cover' }),
  beat('caseFound', 260, 'the 14th-floor laboratory of the tower', { truth: true, detail: 'the tower · a lab' }),
  beat('escaped', 380, 'the street'),
], { clues: 1, closeCalls: 1 }, { conditions: ['rain'] })

const RAMPAGE = record([
  beat('landed', 30, 'the tower roof'),
  beat('entered', 35, 'the 22nd-floor penthouse of the tower', { detail: 'blast' }),
  beat('explosion', 34, 'the 22nd-floor penthouse of the tower', { n: 1 }),
  beat('down', 36, 'the 22nd-floor penthouse of the tower', { who: 'officer Brandt', detail: 'blast', n: 1 }),
  beat('alert', 37, 'the 22nd-floor penthouse of the tower', { n: 3, detail: 'explosion' }),
  beat('spotted', 40, 'the 21st-floor office of the tower', { who: 'Sato', n: 1 }),
  beat('surrender', 60, 'the 21st-floor office of the tower', { who: 'Novak' }),
  beat('fire', 90, 'the 18th-floor server room of the tower', { n: 80 }),
  beat('collapse', 140, 'the 18th-floor server room of the tower', { n: 120 }),
  beat('alert', 150, 'the 17th-floor office of the tower', { n: 4, detail: 'sighting' }),
  beat('lowHealth', 200, 'the 5th-floor lobby of the tower', { n: 14 }),
  beat('caseFound', 230, 'the vault on basement level 2 of the tower', { truth: false, detail: 'the tower · floors 12-16' }),
  beat('escaped', 300, 'the street'),
], { seen: 9, seenBy: 6, alarms: 1, peakLevel: 4, killed: 17, knockedOut: 2, tilesDestroyed: 900, explosions: 11, shots: 140, collapses: 1, maxFire: 80, surrendered: 1 })

const sentences = (text: string[]) => text.length

describe('the debrief story', () => {
  it('tells between six and twelve sentences, opening with the drop and ending with the getaway', () => {
    for (const heist of [GHOST, RAMPAGE]) {
      const story = composeDebrief(heist).story
      expect(sentences(story)).toBeGreaterThanOrEqual(6)
      expect(sentences(story)).toBeLessThanOrEqual(12)
      expect(story[0]).toMatch(/parachuted|drifted down/)
      expect(story.at(-1)).toMatch(/van/)
    }
  })

  it('mentions the real beats, in the order they happened', () => {
    const text = composeDebrief(GHOST).story.join(' ')
    const order = ['heavy rain', 'depot roof', 'window', 'notice board', '41 seconds', 'laboratory', 'van'].map((word) => text.indexOf(word))
    expect(order.every((at) => at >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it('never claims what did not happen: a ghost run has no alarm, no blast, no shot and no body', () => {
    const text = composeDebrief(GHOST).story.join(' ').toLowerCase()
    for (const word of ['alarm went', 'explosion', 'blast', 'shot', 'killed', 'body', 'fell', 'lockdown', 'spotted']) expect(text).not.toContain(word)
  })

  it('tells a false lead as a false lead, and a collapse as a collapse', () => {
    const text = composeDebrief(RAMPAGE).story.join(' ')
    expect(text).toMatch(/nowhere near where the clues pointed|not where anyone had said/)
    expect(text).toMatch(/came down|collapsed/)
    expect(text).toMatch(/Brandt/)
  })

  it('reads differently for a ghost and a rampage: headline, verdict and story', () => {
    const ghost = composeDebrief(GHOST)
    const rampage = composeDebrief(RAMPAGE)
    expect(ghost.verdict.style).toBe('ghost')
    expect(rampage.verdict.style).toBe('catastrophe')
    expect(ghost.headline).not.toBe(rampage.headline)
    expect(ghost.story.filter((line) => rampage.story.includes(line))).toEqual([])
    expect(ghost.highlights.join(' ')).toMatch(/41 seconds/)
    expect(rampage.highlights.join(' ')).toMatch(/Brought|killed|nearly dying/)
  })

  it('is the same every time for the same heist', () => {
    expect(composeDebrief(RAMPAGE)).toEqual(composeDebrief(RAMPAGE))
  })

  it('tells a death as a death, and says whether the case was in hand', () => {
    const dead = record([beat('landed', 20, 'the tower roof'), beat('caseFound', 200, 'the 14th-floor laboratory of the tower'), beat('died', 260, 'the 2nd-floor office of the tower')], { killed: 3, alarms: 1, peakLevel: 3, seen: 2 }, { outcome: 'dead', carrying: true })
    const debrief = composeDebrief(dead)
    expect(debrief.story.at(-1)).toMatch(/fell with the case in hand/)
    expect(debrief.headline).toMatch(/fall|fallen|recovered/i)
    expect(debrief.numbers.find((entry) => entry.label === 'Loot')?.value).toBe('Dropped')
  })

  it('lists the numbers the player cares about', () => {
    const labels = composeDebrief(RAMPAGE).numbers.map((entry) => entry.label)
    expect(labels).toEqual(['Time', 'Seen', 'Alarms', 'Knocked out', 'Killed', 'Destroyed', 'Loot'])
  })
})
