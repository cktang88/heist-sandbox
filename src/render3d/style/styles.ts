import { Color } from 'three'

/**
 * The art style ("look") the whole frame is drawn in. A style is mostly data: how materials are pulled
 * toward one family before lighting (`surface`), which camera it uses, and which finishing chain the
 * post-processing builds (`finish`). Adding a look means adding an entry here, plus a finishing pass
 * only if none of the existing ones fits.
 *
 * Pick one with `?look=<name>` in the address. The default is `real`, the plain photographic render.
 */

/**
 * Material-side unification, applied inside every standard material before lighting (see materialStyle.ts).
 * The neutral values (see NEUTRAL_SURFACE) leave a material exactly as authored.
 */
export type SurfaceStyle = {
  /** Albedo brightness is squeezed into this range (linear, 0..1), so photo scans and flat colours sit in one value band. */
  valueMin: number
  valueMax: number
  /** Albedo saturation above this is pulled down. 1 leaves colour alone. */
  saturationMax: number
  /** Albedo is pulled this far (0..1) toward a two-colour ramp chosen by its own brightness, so every surface shares one colour family. */
  rampPull: number
  rampDark: Color
  rampLight: Color
  /** Share of normal-map detail kept (0 flattens to the geometry's own normals). */
  normalDetail: number
  /** Roughness is squeezed into this range, so nothing is mirror-clean next to dull plaster. */
  roughnessMin: number
  roughnessMax: number
  /** Scale on reflected sky (specular environment light): photographed reflections are the loudest "different asset" tell. */
  reflections: number
}

export const NEUTRAL_SURFACE: SurfaceStyle = {
  valueMin: 0,
  valueMax: 1,
  saturationMax: 1,
  rampPull: 0,
  rampDark: new Color(0, 0, 0),
  rampLight: new Color(1, 1, 1),
  normalDetail: 1,
  roughnessMin: 0,
  roughnessMax: 1,
  reflections: 1,
}

/** The low-resolution, limited-palette look: everything is drawn into a fixed grid of art pixels. */
export type PixelFinish = {
  kind: 'pixel'
  /** Art pixels from top to bottom of the screen, before the nearest-neighbour upscale (rounded to a whole screen-pixel scale). */
  artHeight: number
  /** Ordered-dither strength, roughly one palette step. */
  dither: number
  /** Ink strength on outer silhouettes and on inner creases (0..1). */
  silhouetteInk: number
  creaseInk: number
}

/** Graphic-novel pencil: near monochrome with colour kept for lights, hatching in shadow, ink lines and paper. */
export type SketchFinish = {
  kind: 'sketch'
  paper: Color
  ink: Color
  /** How much hue survives on bright, saturated pixels (lamps, neon, fire, goggles) and on strong reds (blood, alarm). */
  keepColour: number
  /** Hand-drawn frames per second: strokes and lines jump to a new variant this often, never every frame. */
  boilRate: number
  /** Outline width in screen pixels at 1080p. */
  lineWidth: number
}

/** Painted realism: edge-preserving smoothing (anisotropic Kuwahara) at reduced resolution, a strong grade, canvas. */
export type PaintFinish = {
  kind: 'paint'
  /** Share of the render resolution the smoothing runs at. */
  scale: number
  /** Kuwahara radius in pixels of the reduced image. */
  radius: number
  shadowTint: Color
  highlightTint: Color
  /** Soft darkening along depth edges (0 = none). */
  edgeDarken: number
  canvas: number
}

export type RealFinish = { kind: 'real' }

export type Finish = RealFinish | PixelFinish | SketchFinish | PaintFinish

export type Style = {
  name: StyleName
  surface: SurfaceStyle
  /** `ortho` draws the building with an orthographic camera snapped to the art-pixel grid; the far backdrop keeps perspective. */
  camera: 'perspective' | 'ortho'
  /** Film grain and colour fringing of the shared grade (0..1 of their usual amount). Looks with their own texture turn these off. */
  lens: number
  finish: Finish
}

export const STYLE_NAMES = ['real', 'pixel', 'pixel-hd', 'sketch', 'paint'] as const
/** The look used when the address names none. */
export const DEFAULT_STYLE: StyleName = 'pixel'
export type StyleName = (typeof STYLE_NAMES)[number]

const PIXEL_SURFACE: SurfaceStyle = {
  valueMin: 0.03,
  valueMax: 0.62,
  saturationMax: 0.5,
  // Cool slate walls, so warm lamplight reads as orange against blue-violet shade, as in the reference street.
  rampPull: 0.3,
  rampDark: new Color(0.05, 0.055, 0.1),
  rampLight: new Color(0.5, 0.52, 0.58),
  normalDetail: 0.3,
  roughnessMin: 0.55,
  roughnessMax: 1,
  reflections: 0.45,
}

function pixel(name: StyleName, artHeight: number): Style {
  return {
    name,
    surface: PIXEL_SURFACE,
    camera: 'ortho',
    lens: 0,
    finish: { kind: 'pixel', artHeight, dither: artHeight > 400 ? 0.035 : 0.05, silhouetteInk: 1, creaseInk: 0.4 },
  }
}

export const STYLES: Record<StyleName, Style> = {
  real: { name: 'real', surface: NEUTRAL_SURFACE, camera: 'perspective', lens: 1, finish: { kind: 'real' } },
  // About three screen pixels per art pixel at 1080p (two at 720p): big enough to read as pixel art,
  // small enough that a 1.6-tile person is still 24 art pixels tall.
  pixel: pixel('pixel', 360),
  // The "super high res" variant: two screen pixels per art pixel at 1080p.
  'pixel-hd': pixel('pixel-hd', 540),
  sketch: {
    name: 'sketch',
    surface: {
      valueMin: 0.06,
      valueMax: 0.7,
      saturationMax: 0.14,
      rampPull: 0.35,
      rampDark: new Color(0.08, 0.075, 0.07),
      rampLight: new Color(0.66, 0.62, 0.55),
      normalDetail: 0.45,
      roughnessMin: 0.6,
      roughnessMax: 1,
      reflections: 0.3,
    },
    camera: 'perspective',
    lens: 0,
    finish: { kind: 'sketch', paper: new Color(0.86, 0.82, 0.73), ink: new Color(0.07, 0.065, 0.07), keepColour: 0.9, boilRate: 4, lineWidth: 2 },
  },
  paint: {
    name: 'paint',
    surface: {
      valueMin: 0.04,
      valueMax: 0.72,
      saturationMax: 0.55,
      rampPull: 0.25,
      rampDark: new Color(0.05, 0.09, 0.1),
      rampLight: new Color(0.7, 0.6, 0.48),
      normalDetail: 0.35,
      roughnessMin: 0.5,
      roughnessMax: 1,
      reflections: 0.5,
    },
    camera: 'perspective',
    lens: 0,
    finish: {
      kind: 'paint',
      scale: 0.5,
      radius: 4,
      shadowTint: new Color(0.82, 1.0, 1.06),
      highlightTint: new Color(1.1, 1.0, 0.86),
      edgeDarken: 0.35,
      canvas: 0.06,
    },
  },
}

/** Reads `?look=`; anything unknown falls back to the default. */
export function styleFromQuery(search: string): Style {
  const name = new URLSearchParams(search).get('look')
  return STYLES[(STYLE_NAMES as readonly string[]).includes(name ?? '') ? (name as StyleName) : DEFAULT_STYLE]
}
