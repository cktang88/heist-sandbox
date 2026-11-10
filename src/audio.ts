import type { SoundKind } from './game/sounds'
import { centerOf } from './game/types'
import type { World } from './game/world'

/**
 * Thin adapter that turns the game's sound events into audio.
 * Gunfire and explosions are real recordings (CC0, see public/textures/LICENSE.md).
 * Everything else, and any recording that has not loaded yet, is synthesised from noise and tones.
 */
export type GameAudio = { update(world: World): void }

type Voice = { seconds: number; gain: number; lowpass: number; highpass: number; thump: number; thumpGain: number }

const VOICES: Record<SoundKind, Voice> = {
  pistol: { seconds: 0.07, gain: 0.25, lowpass: 9000, highpass: 2500, thump: 0, thumpGain: 0 },
  rifle: { seconds: 0.13, gain: 0.5, lowpass: 5200, highpass: 300, thump: 150, thumpGain: 0.5 },
  shotgun: { seconds: 0.28, gain: 0.75, lowpass: 3000, highpass: 80, thump: 90, thumpGain: 0.9 },
  sniper: { seconds: 0.4, gain: 0.8, lowpass: 6500, highpass: 120, thump: 110, thumpGain: 0.9 },
  rocket: { seconds: 0.35, gain: 0.4, lowpass: 1400, highpass: 200, thump: 70, thumpGain: 0.5 },
  guardShot: { seconds: 0.12, gain: 0.4, lowpass: 4200, highpass: 400, thump: 170, thumpGain: 0.4 },
  explosion: { seconds: 1.1, gain: 1, lowpass: 900, highpass: 20, thump: 55, thumpGain: 1.2 },
  kill: { seconds: 0.12, gain: 0.3, lowpass: 700, highpass: 60, thump: 80, thumpGain: 0.5 },
  door: { seconds: 0.05, gain: 0.3, lowpass: 3000, highpass: 900, thump: 0, thumpGain: 0 },
  reload: { seconds: 0.04, gain: 0.25, lowpass: 6000, highpass: 1800, thump: 0, thumpGain: 0 },
  collapse: { seconds: 0.3, gain: 0.45, lowpass: 600, highpass: 30, thump: 60, thumpGain: 0.6 },
  pickup: { seconds: 0.05, gain: 0.1, lowpass: 8000, highpass: 3000, thump: 0, thumpGain: 0 },
}

/** Recordings in `public/audio`, by the sound they replace. */
const RECORDINGS: Partial<Record<SoundKind, { file: string; gain: number }>> = {
  rifle: { file: 'rifle', gain: 0.55 },
  shotgun: { file: 'shotgun', gain: 0.8 },
  sniper: { file: 'sniper', gain: 0.85 },
  guardShot: { file: 'guard', gain: 0.5 },
  explosion: { file: 'explosion', gain: 1 },
}

const HEARING_TILES = 14
const PAN_TILES = 22

export function createAudio(): GameAudio {
  let context: AudioContext | null = null
  let master: BiquadFilterNode | null = null
  let noise: AudioBuffer | null = null
  let siren: { tone: OscillatorNode; gain: GainNode } | null = null
  const samples = new Map<SoundKind, AudioBuffer>()

  // Browsers only allow sound after the player has clicked or pressed a key.
  const unlock = () => {
    if (context) return
    context = new AudioContext()
    master = context.createBiquadFilter()
    master.type = 'lowpass'
    master.frequency.value = 20000
    master.connect(context.destination)
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const hiss = noise.getChannelData(0)
    for (let index = 0; index < hiss.length; index += 1) hiss[index] = Math.random() * 2 - 1
    for (const [kind, recording] of Object.entries(RECORDINGS) as [SoundKind, { file: string }][]) {
      fetch(`${import.meta.env.BASE_URL}audio/${recording.file}.mp3`)
        .then((response) => response.arrayBuffer())
        .then((data) => context!.decodeAudioData(data))
        .then((buffer) => samples.set(kind, buffer))
        .catch(() => undefined)
    }
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)

  function play(kind: SoundKind, loudness: number, pan: number, pitch: number): void {
    if (!context || !master || !noise) return
    const recorded = samples.get(kind)
    if (recorded) {
      const source = context.createBufferSource()
      source.buffer = recorded
      source.playbackRate.value = pitch * (0.96 + Math.random() * 0.08)
      const level = context.createGain()
      level.gain.value = (RECORDINGS[kind]?.gain ?? 1) * loudness
      const side = context.createStereoPanner()
      side.pan.value = pan
      source.connect(level).connect(side).connect(master)
      source.start()
      return
    }
    const voice = VOICES[kind]
    const now = context.currentTime
    const length = voice.seconds / pitch
    const out = context.createStereoPanner()
    out.pan.value = pan
    out.connect(master)

    const hiss = context.createBufferSource()
    hiss.buffer = noise
    hiss.playbackRate.value = pitch * (0.92 + Math.random() * 0.16)
    const low = context.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.setValueAtTime(voice.lowpass * pitch, now)
    low.frequency.exponentialRampToValueAtTime(Math.max(60, voice.lowpass * pitch * 0.15), now + length)
    const high = context.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = voice.highpass
    const level = context.createGain()
    level.gain.setValueAtTime(voice.gain * loudness, now)
    level.gain.exponentialRampToValueAtTime(0.0008, now + length)
    hiss.connect(low).connect(high).connect(level).connect(out)
    hiss.start(now, Math.random() * 0.5, length)

    if (voice.thump > 0) {
      const tone = context.createOscillator()
      tone.frequency.setValueAtTime(voice.thump * pitch, now)
      tone.frequency.exponentialRampToValueAtTime(voice.thump * pitch * 0.35, now + length)
      const body = context.createGain()
      body.gain.setValueAtTime(voice.thumpGain * loudness, now)
      body.gain.exponentialRampToValueAtTime(0.0008, now + length)
      tone.connect(body).connect(out)
      tone.start(now)
      tone.stop(now + length)
    }
  }

  function setSiren(on: boolean, pitch: number): void {
    if (!context || !master) return
    if (on && !siren) {
      const tone = context.createOscillator()
      tone.type = 'sawtooth'
      const gain = context.createGain()
      gain.gain.value = 0.035
      tone.connect(gain).connect(master)
      tone.start()
      siren = { tone, gain }
    }
    if (!on && siren) {
      siren.tone.stop()
      siren = null
    }
    if (siren) siren.tone.frequency.value = (Math.floor(context.currentTime * 2) % 2 === 0 ? 620 : 470) * pitch
  }

  return {
    update(world) {
      const events = world.sounds.splice(0)
      if (!context || !master) return
      // Slow motion drops the pitch and muffles everything, which sells the effect.
      const pitch = 0.45 + world.time.scale * 0.55
      master.frequency.value = 500 + world.time.scale * world.time.scale * 19500
      const ear = centerOf(world.drone ?? world.player)
      for (const event of events) {
        const gap = Math.hypot(event.x - ear.x, event.y - ear.y)
        play(event.kind, 1 / (1 + gap / HEARING_TILES), Math.max(-1, Math.min(1, (event.x - ear.x) / PAN_TILES)), pitch)
      }
      setSiren(world.alarm && world.status === 'playing', pitch)
    },
  }
}
