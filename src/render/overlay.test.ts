import { describe, expect, it } from 'vitest'
import { createWorld } from '../game/world'
import { iconFor, placeLabel } from './overlay'

describe('speech labels', () => {
  const box = { w: 100, h: 20, top: 14 }
  const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < box.w && Math.abs(a.y - b.y) < box.h

  it('stack above one another without overlapping, however many speak at once', () => {
    const placed: { x: number; y: number; w: number }[] = []
    for (let index = 0; index < 6; index += 1) placed.push({ x: 300 + index * 10, y: placeLabel(placed, 300 + index * 10, box.w, box.h, 400, box.top), w: box.w })
    for (const a of placed) for (const b of placed) if (a !== b) expect(overlaps(a, b)).toBe(false)
  })

  it('never go off the top of the screen: near the top they stack downward', () => {
    const placed: { x: number; y: number; w: number }[] = []
    for (let index = 0; index < 4; index += 1) placed.push({ x: 300, y: placeLabel(placed, 300, box.w, box.h, -30, box.top), w: box.w })
    for (const label of placed) expect(label.y).toBeGreaterThanOrEqual(box.top)
    for (const a of placed) for (const b of placed) if (a !== b) expect(overlaps(a, b)).toBe(false)
  })
})

function guard() {
  return createWorld(1, 'outpost').guards[0]
}

describe('the icon over a guard', () => {
  it('follows his detailed mode, which the coarse state lumps together', () => {
    const expected = { calm: null, caution: null, noticed: 'suspicious', investigating: 'suspicious', searching: 'searching', combat: 'alert', toAlarm: 'radio', panic: 'panic', surrendered: 'surrendered' } as const
    for (const [mode, icon] of Object.entries(expected)) expect(iconFor({ ...guard(), mode: mode as keyof typeof expected }), mode).toBe(icon)
  })

  it('shows the radio while he is calling it in, so the player knows to stop him', () => {
    expect(iconFor({ ...guard(), mode: 'noticed', radio: { event: { kind: 'noise', at: { x: 0, y: 0 }, loud: false }, seconds: 2 } })).toBe('radio')
  })

  it('marks guards who are out cold or tied, and nothing over the dead or the hidden', () => {
    expect(iconFor({ ...guard(), out: true })).toBe('out')
    expect(iconFor({ ...guard(), mode: 'surrendered', restrained: true })).toBe('tied')
    expect(iconFor({ ...guard(), state: 'dead', mode: 'dead' })).toBeNull()
    expect(iconFor({ ...guard(), out: true, hiddenIn: 3 })).toBeNull()
  })
})
