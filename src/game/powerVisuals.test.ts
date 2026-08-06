import { describe, expect, it } from 'vitest'
import { ACTIVE_POWER_OPTIONS } from './config'
import { POWER_VISUALS } from './powerVisuals'

describe('power visual identity', () => {
  it('gives every battlefield power a unique shape-and-color signature', () => {
    const identities = ACTIVE_POWER_OPTIONS.map(({ kind }) => POWER_VISUALS[kind])
    expect(identities.every((identity) => identity.color.startsWith('#'))).toBe(true)
    expect(new Set(identities.map((identity) => `${identity.mark}:${identity.color}`)).size).toBe(identities.length)
    expect(new Set(identities.map((identity) => identity.mark)).size).toBe(identities.length)
  })
})
