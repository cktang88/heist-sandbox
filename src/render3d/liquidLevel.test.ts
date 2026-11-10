import { describe, expect, it } from 'vitest'
import { levelDepths } from './liquidLevel'

describe('levelDepths', () => {
  it('draws an unbroken run of cells at one level holding the same volume', () => {
    const cells = [{ x: 5, y: 9, depth: 0.3 }, { x: 3, y: 9, depth: 0.9 }, { x: 4, y: 9, depth: 0.6 }]
    expect([...levelDepths(cells)].map((d) => d.toFixed(2))).toEqual(['0.60', '0.60', '0.60'])
  })

  it('keeps runs apart across a gap and across rows', () => {
    const cells = [{ x: 1, y: 2, depth: 1 }, { x: 3, y: 2, depth: 0.2 }, { x: 2, y: 3, depth: 0.5 }, { x: 1, y: 3, depth: 0.1 }]
    expect([...levelDepths(cells)].map((d) => d.toFixed(2))).toEqual(['1.00', '0.20', '0.30', '0.30'])
  })

  it('handles no cells', () => {
    expect(levelDepths([]).length).toBe(0)
  })
})
