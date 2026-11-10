import { describe, expect, it } from 'vitest'
import { createWorld } from '../game/world'
import { iconFor } from './overlay'

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
