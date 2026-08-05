import { describe, expect, it } from 'vitest'
import { consumeCombatAudioEvents, createCombatAudioState, effectiveEffectsVolume, effectiveMusicVolume, hasNewReadyCooldown, playSound, setBattleMusic, updateAudioMix } from './audio'
import { DEFAULT_SETTINGS } from './settings'

describe('generated audio cues', () => {
  it('combines and clamps master and effects volume', () => {
    expect(effectiveEffectsVolume({ masterVolume: 0.5, effectsVolume: 0.8 })).toBeCloseTo(0.4)
    expect(effectiveEffectsVolume({ masterVolume: 2, effectsVolume: -1 })).toBe(0)
    expect(effectiveMusicVolume({ masterVolume: 0.8, musicVolume: 0.5 })).toBeCloseTo(0.4)
  })

  it('is safe when browser audio is unavailable', () => {
    expect(() => playSound('place', DEFAULT_SETTINGS)).not.toThrow()
    expect(() => setBattleMusic(false, DEFAULT_SETTINGS)).not.toThrow()
    expect(() => updateAudioMix(DEFAULT_SETTINGS)).not.toThrow()
  })

  it('detects only cooldown transitions that become ready', () => {
    expect(hasNewReadyCooldown({ strafe: 0.1, nuke: 0 }, { strafe: 0, nuke: 0 })).toBe(true)
    expect(hasNewReadyCooldown({ strafe: 0, nuke: 0 }, { strafe: 0, nuke: 0 })).toBe(false)
    expect(hasNewReadyCooldown({ strafe: 2 }, { strafe: 1 })).toBe(false)
  })

  it('collapses large combat bursts and rate-limits repeated cues', () => {
    const state = createCombatAudioState()
    expect(consumeCombatAudioEvents(state, { shots: 100, impacts: 30, leaks: 2, wallBreaks: 1 }, 1))
      .toEqual(['shot', 'impact', 'leak', 'wallBreak'])
    expect(consumeCombatAudioEvents(state, { shots: 200, impacts: 60, leaks: 2, wallBreaks: 1 }, 1.05)).toEqual([])
    expect(consumeCombatAudioEvents(state, { shots: 201, impacts: 61, leaks: 2, wallBreaks: 1 }, 1.2)).toEqual(['shot', 'impact'])
  })
})
