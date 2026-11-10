import { describe, expect, it } from 'vitest'
import { parsePastHeists, type PastHeist } from './debriefStore'

const good: PastHeist = {
  seed: 7, site: 'complex', when: 'today',
  debrief: {
    headline: 'Raid ends', dateline: 'Blackmoor', story: ['It happened.'], verdict: { style: 'loud', word: 'LOUD', line: 'Everyone heard.' },
    numbers: [{ label: 'Time', value: '1:00' }], highlights: [], outcome: 'won', briefing: [],
  },
}

describe('past heists from storage', () => {
  it('keep whole entries', () => {
    expect(parsePastHeists(JSON.stringify([good]))).toEqual([good])
  })

  it('drop entries the debrief screen could not draw instead of breaking the list', () => {
    const { verdict: _verdict, ...noVerdict } = good.debrief
    const { highlights: _highlights, ...noHighlights } = good.debrief
    const stored = [{ ...good, debrief: noVerdict }, { ...good, debrief: noHighlights }, { ...good, debrief: { ...good.debrief, numbers: [null] } }, good, 'junk', null]
    expect(parsePastHeists(JSON.stringify(stored))).toEqual([good])
  })

  it('read broken or missing storage as an empty list', () => {
    expect(parsePastHeists(null)).toEqual([])
    expect(parsePastHeists('{oops')).toEqual([])
    expect(parsePastHeists('{"a":1}')).toEqual([])
  })
})
