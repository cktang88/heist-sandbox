import { describe, expect, it } from 'vitest'
import type { Remembered } from '../game/people/types'
import { parseRemembered } from './nemesisStore'

const good: Remembered = { first: 'Ivo', last: 'Kerr', rank: 'Guard', traits: ['lazy', 'brave'], site: 'Blackmoor', heist: 3, what: 'spared' }

describe('stored nemeses', () => {
  it('read back what was stored', () => {
    expect(parseRemembered(JSON.stringify([good]))).toEqual([good])
  })

  it('drop broken text and malformed entries', () => {
    expect(parseRemembered(null)).toEqual([])
    expect(parseRemembered('{oops')).toEqual([])
    expect(parseRemembered('{"a":1}')).toEqual([])
    const bad = [{ ...good, what: 'friends' }, { ...good, traits: ['flying'] }, { ...good, heist: 'x' }, { ...good, first: '' }, 7, null]
    expect(parseRemembered(JSON.stringify([...bad, good]))).toEqual([good])
  })
})
