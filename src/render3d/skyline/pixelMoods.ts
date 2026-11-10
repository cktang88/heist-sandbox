import type { TimeOfDay } from '../../game/site'
import type { LayerName } from './frame'
import type { MoodName } from './moods'
import type { Ink } from './pixelPalette'

/**
 * The colour script of the pixel backdrop, in palette indices (see style/palette.ts): a few flat tones per
 * layer with clear steps between them, so each layer reads as a silhouette and depth reads as value (lighter
 * and bluer with distance by day; darker to lighter by night, against a glowing horizon).
 *
 * Index cheat sheet: 0-11 cool neutrals (black to white), 12-20 warm greys, 21-23 olive, 24-29 amber,
 * 30-33 magenta, 34-37 cyan, 38-41 green, 42-44 red.
 */
export type PixelLayerInks = {
  /** Front row and back row of the layer. */
  wall: Ink
  back: Ink
  /** One-pixel edge on the side facing the light. */
  rim: Ink
  /** Unlit glass where it shows (by day), or null to leave walls plain. */
  glass: Ink | null
  /** The flat band of haze at the foot of the layer, and the street below it. */
  haze: Ink
}

export type PixelMood = {
  time: TimeOfDay
  /** Sky bands: from this height above the street (tiles) upward, this ink. Highest first. */
  sky: readonly (readonly [number, Ink])[]
  stars: { ink: Ink; bright: Ink; density: number } | null
  /** Sun or moon: body, rim, and a flat halo around it reaching `reach` times its radius. */
  disc: { body: Ink; rim: Ink; halo: Ink; reach: number } | null
  /** Cloud body and its edge ink; `under` puts the edge on the underside (lit by the city, or in shade), else on top. */
  clouds: { body: Ink; edge: Ink; under: boolean; cover: number }
  layers: Record<LayerName, PixelLayerInks>
  /** Lit windows: bright and dim, warm and cold, per layer (far windows are dimmer). */
  warm: Record<LayerName, readonly [Ink, Ink]>
  cold: Record<LayerName, readonly [Ink, Ink]>
  /** Signs light up (night) or show as painted boards (day). */
  neon: boolean
  /** Out-of-focus discs: share kept per layer (0 drops them, beacons always stay). */
  discs: Record<LayerName, number>
  rain: Ink | null
  /** How many tiles the haze band climbs at the foot of each layer. */
  hazeHeight: Record<LayerName, number>
}

const NIGHT: PixelMood = {
  time: 'night',
  sky: [[200, 0], [70, 2], [28, 3], [8, 6]],
  stars: { ink: 5, bright: 8, density: 0.0005 },
  disc: null,
  clouds: { body: 2, edge: 2, under: true, cover: 0.4 },
  layers: {
    far: { wall: 5, back: 5, rim: 6, glass: null, haze: 6 },
    mid: { wall: 3, back: 3, rim: 5, glass: null, haze: 5 },
    near: { wall: 0, back: 2, rim: 3, glass: null, haze: 3 },
  },
  warm: { far: [26, 25], mid: [27, 26], near: [28, 27] },
  cold: { far: [35, 34], mid: [7, 6], near: [8, 7] },
  neon: true,
  discs: { far: 0.9, mid: 0.8, near: 0.5 },
  rain: null,
  hazeHeight: { far: 40, mid: 22, near: 6 },
}

export const PIXEL_MOODS: Record<MoodName, PixelMood> = {
  night: NIGHT,
  wet: {
    ...NIGHT,
    sky: [[200, 0], [60, 2], [24, 3], [6, 6]],
    stars: null,
    clouds: { body: 2, edge: 3, under: true, cover: 0.8 },
    rain: 6,
    hazeHeight: { far: 60, mid: 30, near: 9 },
  },
  moonlit: {
    ...NIGHT,
    sky: [[210, 0], [90, 2], [34, 3], [8, 7]],
    stars: { ink: 5, bright: 9, density: 0.0012 },
    disc: { body: 11, rim: 10, halo: 3, reach: 1.7 },
    clouds: { body: 2, edge: 5, under: false, cover: 0.35 },
    layers: {
      far: { wall: 6, back: 6, rim: 7, glass: null, haze: 7 },
      mid: { wall: 3, back: 3, rim: 6, glass: null, haze: 5 },
      near: { wall: 0, back: 2, rim: 5, glass: null, haze: 3 },
    },
  },
  dusk: {
    time: 'day',
    sky: [[280, 5], [220, 31], [170, 26], [110, 27], [50, 28]],
    stars: null,
    disc: { body: 29, rim: 29, halo: 28, reach: 1.6 },
    clouds: { body: 31, edge: 28, under: true, cover: 0.4 },
    layers: {
      far: { wall: 30, back: 30, rim: 31, glass: null, haze: 26 },
      mid: { wall: 3, back: 3, rim: 30, glass: null, haze: 30 },
      near: { wall: 0, back: 3, rim: 5, glass: null, haze: 3 },
    },
    warm: { far: [27, 26], mid: [28, 27], near: [28, 27] },
    cold: { far: [8, 7], mid: [9, 8], near: [9, 8] },
    neon: true,
    discs: { far: 0.25, mid: 0.2, near: 0.25 },
    rain: null,
    hazeHeight: { far: 30, mid: 16, near: 5 },
  },
  overcast: {
    time: 'day',
    sky: [[270, 9], [-40, 10]],
    stars: null,
    disc: null,
    clouds: { body: 11, edge: 9, under: true, cover: 0.45 },
    layers: {
      far: { wall: 9, back: 9, rim: 10, glass: null, haze: 10 },
      mid: { wall: 8, back: 8, rim: 9, glass: 7, haze: 9 },
      near: { wall: 6, back: 7, rim: 8, glass: 5, haze: 8 },
    },
    warm: { far: [10, 10], mid: [19, 18], near: [19, 18] },
    cold: { far: [10, 10], mid: [10, 9], near: [10, 9] },
    neon: false,
    discs: { far: 0, mid: 0, near: 0 },
    rain: null,
    hazeHeight: { far: 50, mid: 24, near: 6 },
  },
}
