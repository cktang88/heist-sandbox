import { describe, expect, it } from 'vitest'
import { nextHop, type HoleFinder } from './nav'
import type { Stairwell } from './site'

/** One staircase at the left end (landings at x 10 and 16), floors at feet rows 100 and 94. */
const WELL: Stairwell = { id: 0, building: 'test', leftX: 10, rightX: 16, stops: [100, 94] }
const holeAt = (column: number): HoleFinder => (floorY, x) => (floorY === 94 && Math.abs(column - x) < 40 ? column : null)

describe('routes through holes in the floor', () => {
  it('drops through a hole when it is shorter than going round by the stairs', () => {
    expect(nextHop([WELL], { x: 50, y: 94 }, { x: 55, y: 100 }, holeAt(52))).toEqual({ kind: 'drop', x: 52.5 })
  })

  it('takes the stairs when they are the shorter way', () => {
    expect(nextHop([WELL], { x: 18, y: 94 }, { x: 12, y: 100 }, holeAt(52))).toEqual({ kind: 'walk', x: 16 })
  })

  it('a hole is a way down only', () => {
    expect(nextHop([WELL], { x: 50, y: 100 }, { x: 55, y: 94 }, holeAt(52))).toEqual({ kind: 'walk', x: 10 })
  })

  it('a hole serves a floor no staircase reaches', () => {
    expect(nextHop([], { x: 50, y: 94 }, { x: 20, y: 100 }, holeAt(52))).toEqual({ kind: 'drop', x: 52.5 })
  })

  it('without a hole finder routes go by the stairs', () => {
    expect(nextHop([WELL], { x: 50, y: 94 }, { x: 55, y: 100 })).toEqual({ kind: 'walk', x: 16 })
  })
})
