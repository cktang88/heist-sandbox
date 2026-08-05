import type { GameSettings } from './settings'

export type SoundCue = 'place' | 'start' | 'power' | 'ready' | 'pause' | 'victory' | 'defeat' | 'shot' | 'impact' | 'leak' | 'wallBreak'

export type CombatEventTotals = { shots: number; impacts: number; leaks: number; wallBreaks: number }
export type CombatAudioState = { seen: CombatEventTotals; lastPlayedAt: Partial<Record<SoundCue, number>> }

type CueDefinition = {
  frequency: number
  endFrequency: number
  duration: number
  wave: OscillatorType
  volume: number
}

const CUES: Record<SoundCue, CueDefinition> = {
  place: { frequency: 180, endFrequency: 120, duration: 0.08, wave: 'square', volume: 0.12 },
  start: { frequency: 110, endFrequency: 220, duration: 0.35, wave: 'sawtooth', volume: 0.16 },
  power: { frequency: 420, endFrequency: 95, duration: 0.28, wave: 'sawtooth', volume: 0.18 },
  ready: { frequency: 330, endFrequency: 660, duration: 0.18, wave: 'triangle', volume: 0.09 },
  pause: { frequency: 260, endFrequency: 190, duration: 0.09, wave: 'square', volume: 0.08 },
  victory: { frequency: 294, endFrequency: 587, duration: 0.65, wave: 'triangle', volume: 0.15 },
  defeat: { frequency: 170, endFrequency: 62, duration: 0.7, wave: 'sawtooth', volume: 0.13 },
  shot: { frequency: 150, endFrequency: 92, duration: 0.045, wave: 'square', volume: 0.045 },
  impact: { frequency: 88, endFrequency: 45, duration: 0.11, wave: 'sawtooth', volume: 0.065 },
  leak: { frequency: 120, endFrequency: 54, duration: 0.24, wave: 'square', volume: 0.11 },
  wallBreak: { frequency: 74, endFrequency: 38, duration: 0.2, wave: 'sawtooth', volume: 0.1 },
}

const COMBAT_CUE_INTERVAL: Partial<Record<SoundCue, number>> = { shot: 0.1, impact: 0.14, leak: 0.25, wallBreak: 0.3 }

export function createCombatAudioState(totals: CombatEventTotals = { shots: 0, impacts: 0, leaks: 0, wallBreaks: 0 }): CombatAudioState {
  return { seen: { ...totals }, lastPlayedAt: {} }
}

/** Turns any size event burst into at most one cue per category and time window. */
export function consumeCombatAudioEvents(state: CombatAudioState, totals: CombatEventTotals, now: number): SoundCue[] {
  const cues: SoundCue[] = []
  const mappings: [keyof CombatEventTotals, SoundCue][] = [['shots', 'shot'], ['impacts', 'impact'], ['leaks', 'leak'], ['wallBreaks', 'wallBreak']]
  for (const [key, cue] of mappings) {
    const changed = totals[key] > state.seen[key]
    state.seen[key] = totals[key]
    if (!changed || now - (state.lastPlayedAt[cue] ?? Number.NEGATIVE_INFINITY) < (COMBAT_CUE_INTERVAL[cue] ?? 0)) continue
    state.lastPlayedAt[cue] = now
    cues.push(cue)
  }
  return cues
}

let context: AudioContext | null = null
let music: { oscillator: OscillatorNode; gain: GainNode } | null = null

export function effectiveEffectsVolume(settings: Pick<GameSettings, 'masterVolume' | 'effectsVolume'>): number {
  return clamp01(settings.masterVolume) * clamp01(settings.effectsVolume)
}

export function effectiveMusicVolume(settings: Pick<GameSettings, 'masterVolume' | 'musicVolume'>): number {
  return clamp01(settings.masterVolume) * clamp01(settings.musicVolume)
}

export function hasNewReadyCooldown(previous: Readonly<Record<string, number>>, next: Readonly<Record<string, number>>): boolean {
  return Object.keys(next).some((key) => (previous[key] ?? 0) > 0 && next[key] <= 0)
}

export function playSound(cue: SoundCue, settings: GameSettings): void {
  const volume = effectiveEffectsVolume(settings)
  if (volume <= 0 || typeof window === 'undefined') return
  const AudioContextClass = window.AudioContext
  if (!AudioContextClass) return
  try {
    context ??= new AudioContextClass()
    if (context.state === 'suspended') void context.resume()
    const definition = CUES[cue]
    const start = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = definition.wave
    oscillator.frequency.setValueAtTime(definition.frequency, start)
    oscillator.frequency.exponentialRampToValueAtTime(definition.endFrequency, start + definition.duration)
    gain.gain.setValueAtTime(Math.max(0.0001, definition.volume * volume), start)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + definition.duration)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start(start)
    oscillator.stop(start + definition.duration)
  } catch {
    // Audio must never make the simulation or UI fail.
  }
}

export function setBattleMusic(active: boolean, settings: GameSettings): void {
  const volume = effectiveMusicVolume(settings)
  if (!active || volume <= 0) {
    stopMusic()
    return
  }
  if (typeof window === 'undefined' || !window.AudioContext) return
  try {
    context ??= new window.AudioContext()
    if (context.state === 'suspended') void context.resume()
    if (!music) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'triangle'
      oscillator.frequency.value = 48
      gain.gain.value = 0.0001
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start()
      music = { oscillator, gain }
    }
    music.gain.gain.setTargetAtTime(0.022 * volume, context.currentTime, 0.25)
  } catch {
    stopMusic()
  }
}

export function updateAudioMix(settings: GameSettings): void {
  if (!music || !context) return
  music.gain.gain.setTargetAtTime(0.022 * effectiveMusicVolume(settings), context.currentTime, 0.08)
}

function stopMusic(): void {
  if (!music) return
  try { music.oscillator.stop() } catch { /* already stopped */ }
  music = null
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}
