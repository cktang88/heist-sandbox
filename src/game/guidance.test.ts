import { describe, expect, it } from 'vitest'
import { getGuidance } from './guidance'

describe('contextual guidance', () => {
  it('names only the currently equipped tools', () => {
    const text = getGuidance('briefing', { towers: ['gunner'], powers: ['strafe'] }).steps.join(' ')
    expect(text).toContain('Rivet Gun')
    expect(text).toContain('STRAFE')
    expect(text).not.toContain('Temporary Wall')
  })

  it('does not instruct a powerless run to use powers or walls', () => {
    const text = getGuidance('battle', { towers: ['gunner'], powers: [] }).steps.join(' ')
    expect(text).toContain('no battlefield commands')
    expect(text).not.toContain('Temporary Wall')
    expect(text).not.toContain('Press 1–3')
  })

  it('gives towerless setup instructions without naming tower controls', () => {
    const text = getGuidance('setup', { towers: [], powers: ['strafe'] }).steps.join(' ')
    expect(text).toContain('empty field')
    expect(text).not.toContain('Select a placed tower')
  })
})
