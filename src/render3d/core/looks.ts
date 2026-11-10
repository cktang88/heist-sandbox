import { ACESFilmicToneMapping, AgXToneMapping, Color, type ToneMapping } from 'three'
import type { TimeOfDay } from '../../game/site'
import { SKIES } from '../assetManifest'

/** Colour grade applied after tone mapping, in display space. Tints multiply; 1 is neutral. */
export type Grade = {
  shadowTint: Color
  highlightTint: Color
  /** Added to the darkest tones, so blacks are coloured rather than dead. */
  lift: Color
  saturation: number
  contrast: number
  vignette: number
}

/** Everything that sets the mood of one time of day. */
export type Look = {
  /** Key into `SKIES`: the photographed sky that lights and reflects. */
  sky: keyof typeof SKIES
  skyStrength: number
  /** Sky light left on fully enclosed surfaces (see skyShading), diffuse and specular. */
  indoorDiffuse: number
  indoorSpecular: number
  fogColor: number
  fogDensity: number
  toneMapping: ToneMapping
  exposure: number
  bloom: { strength: number; radius: number; threshold: number }
  grade: Grade
}

/**
 * Night: ACES for punchy neon and deep shadows, teal blacks and warm lamplight.
 * Day: AgX, which keeps bright overcast sky from bleaching to white, with extra contrast to make up
 * for AgX's flatter curve.
 */
export const LOOKS: Record<TimeOfDay, Look> = {
  night: {
    sky: 'city_night',
    skyStrength: 1.6,
    indoorDiffuse: 0.1,
    indoorSpecular: 0.05,
    fogColor: 0x0a0f17,
    fogDensity: 0.0045,
    toneMapping: ACESFilmicToneMapping,
    exposure: 1.1,
    bloom: { strength: 0.7, radius: 0.6, threshold: 1.0 },
    grade: {
      shadowTint: new Color(0.88, 1.0, 1.06),
      highlightTint: new Color(1.06, 1.0, 0.9),
      lift: new Color(0.004, 0.012, 0.018),
      saturation: 0.86,
      contrast: 1.08,
      vignette: 0.5,
    },
  },
  day: {
    sky: 'day_overcast',
    skyStrength: 1.0,
    indoorDiffuse: 0.16,
    indoorSpecular: 0.1,
    fogColor: 0x8d969f,
    fogDensity: 0.006,
    toneMapping: AgXToneMapping,
    exposure: 1.1,
    bloom: { strength: 0.2, radius: 0.5, threshold: 2.2 },
    grade: {
      shadowTint: new Color(0.93, 0.99, 1.04),
      highlightTint: new Color(1.04, 1.01, 0.96),
      lift: new Color(0.006, 0.01, 0.012),
      saturation: 1.0,
      contrast: 1.2,
      vignette: 0.35,
    },
  },
}

/** Same time of day, different weather, chosen from the level so it is stable for a given seed. */
const VARIANTS: Record<TimeOfDay, (keyof typeof SKIES)[]> = {
  night: ['city_night', 'city_night_wet', 'moonlit'],
  day: ['day_overcast', 'day_overcast', 'golden_hour'],
}

/** Skies photographed after rain; the streets under them are drawn wet. */
const WET_SKIES = new Set<string>(['city_night_wet'])

export function lookFor(timeOfDay: TimeOfDay, variantSeed: number): Look & { wet: boolean } {
  const options = VARIANTS[timeOfDay]
  const sky = options[Math.abs(Math.floor(variantSeed)) % options.length]
  return { ...LOOKS[timeOfDay], sky, wet: WET_SKIES.has(sky) }
}
