import type { TimeOfDay } from '../../game/site'

/**
 * The colour script of the backdrop for one sky. The lighting picks a photographed sky per level
 * (core/looks.ts: plain, wet or moonlit night; overcast or golden-hour day); the backdrop follows the same choice
 * so the city outside agrees with the light inside.
 */
export type MoodName = 'night' | 'wet' | 'moonlit' | 'dusk' | 'overcast'

export type Mood = {
  name: MoodName
  /** Sky colour by height above the street (tiles), from the top down. */
  sky: readonly (readonly [number, string])[]
  /** The air: every layer fades toward it with distance and toward the street. */
  haze: string
  /** Building colour of the nearest layer; further layers are mixed toward the haze. */
  building: string
  /** Light catching one edge of each tower, so silhouettes separate from the ones behind. */
  rim: string
  /** Clouds: body and the light on their undersides (city glow at night, sun by day). */
  cloud: string
  cloudLight: string
  /** Share of windows lit, before each building's own bias. */
  lit: number
  /** Window light: warm (sodium, tungsten), cold (fluorescent), screens. */
  warm: readonly string[]
  cold: readonly string[]
  /** Unlit glass, slightly apart from the wall. */
  glass: string
  /** How strongly neon signs shine (0 = switched off boards seen by day). */
  neon: number
  /** Brightness of the out-of-focus light discs (0 hides them). */
  bokeh: number
  /** How thick the air between the layers is (scales each layer's haze): low at dusk, so towers stand dark against the glow. */
  air: number
  /** Thickness of the ground mist (0..1) and whether rain falls in front of the far layers. */
  mist: number
  rain: boolean
  /** Sun or moon: height above the street (tiles), across the sheet (0..1), disc colour, halo colour and size. */
  disc: { height: number; across: number; colour: string; halo: string; size: number; glow: number } | null
  stars: number
  searchlights: boolean
}

export const NEON = ['#ff2d95', '#19e3ff', '#ffb000', '#8a5cff', '#ff3b30', '#7cff4f', '#19e3ff', '#ff2d95'] as const

const NIGHT: Mood = {
  name: 'night',
  sky: [[340, '#050816'], [210, '#0a1026'], [130, '#131833'], [70, '#221d38'], [30, '#3a2a3a'], [8, '#4a3040'], [-20, '#3e2a36']],
  haze: '#30263a',
  building: '#0a0d18',
  rim: '#3a3b64',
  cloud: '#15142a',
  cloudLight: '#5a3a40',
  lit: 0.3,
  warm: ['#ffb057', '#ffc27a', '#ff9a3c', '#ffd49a'],
  cold: ['#a8d4ff', '#c8e6ff', '#7fe0ff'],
  glass: '#0d1222',
  neon: 1,
  bokeh: 1,
  air: 1,
  mist: 0.45,
  rain: false,
  disc: null,
  stars: 0.5,
  searchlights: true,
}

export const MOODS: Record<MoodName, Mood> = {
  night: NIGHT,
  wet: {
    ...NIGHT,
    name: 'wet',
    sky: [[340, '#05070d'], [210, '#0a0e1a'], [130, '#141729'], [70, '#221e33'], [30, '#3a2a3a'], [8, '#4a3044'], [-20, '#3e2a36']],
    haze: '#33293f',
    cloud: '#1b1a2c',
    cloudLight: '#5e4044',
    air: 1.15,
    mist: 0.7,
    rain: true,
    stars: 0,
  },
  moonlit: {
    ...NIGHT,
    name: 'moonlit',
    sky: [[340, '#04070f'], [210, '#08101f'], [130, '#101a30'], [70, '#1a2038'], [30, '#2c2440'], [8, '#3c2a44'], [-20, '#33283a']],
    haze: '#252840',
    rim: '#46557a',
    lit: 0.24,
    air: 0.9,
    disc: { height: 150, across: 0.62, colour: '#e8eefa', halo: '#9fb4ff', size: 3.2, glow: 0.35 },
    stars: 1,
  },
  dusk: {
    name: 'dusk',
    sky: [[340, '#1a1a3a'], [200, '#2c2a55'], [120, '#523a6c'], [60, '#9a4f68'], [28, '#d9774f'], [10, '#f2a35a'], [-20, '#e0905a']],
    haze: '#8a5470',
    building: '#1e1828',
    rim: '#f0a070',
    cloud: '#4a3050',
    cloudLight: '#ffb070',
    lit: 0.14,
    warm: ['#ffbe6a', '#ffd08a', '#ffa850'],
    cold: ['#b8d8ff', '#d0e4ff'],
    glass: '#3a2a3c',
    neon: 0.65,
    bokeh: 0.55,
    air: 0.5,
    mist: 0.5,
    rain: false,
    disc: { height: 22, across: 0.38, colour: '#fff0c8', halo: '#ffb060', size: 7, glow: 1 },
    stars: 0,
    searchlights: false,
  },
  overcast: {
    name: 'overcast',
    sky: [[340, '#4c5a70'], [200, '#5e6c84'], [120, '#75839a'], [60, '#8492aa'], [25, '#8e9cb6'], [8, '#94a0b8'], [-20, '#8a96ae']],
    haze: '#8896b0',
    building: '#323a4c',
    rim: '#a0aabc',
    cloud: '#627090',
    cloudLight: '#8e9fc4',
    lit: 0.035,
    warm: ['#c8ccd4', '#d4d4d4'],
    cold: ['#c4d0e0', '#d0dae8'],
    glass: '#4a5468',
    neon: 0.18,
    bokeh: 0.12,
    air: 1,
    mist: 0.6,
    rain: false,
    disc: { height: 140, across: 0.3, colour: '#f0f4fa', halo: '#dfe6f2', size: 9, glow: 0.4 },
    stars: 0,
    searchlights: false,
  },
}

/** The backdrop mood for a time of day and the photographed sky the lighting chose (a key of `SKIES`). */
export function moodFor(time: TimeOfDay, sky: string | null): Mood {
  if (time === 'day') return MOODS[sky === 'golden_hour' ? 'dusk' : 'overcast']
  if (sky === 'city_night_wet') return MOODS.wet
  if (sky === 'moonlit') return MOODS.moonlit
  return MOODS.night
}
