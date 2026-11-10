import { Data3DTexture, LinearSRGBColorSpace, NearestFilter, RGBAFormat, UnsignedByteType } from 'three'

/**
 * The fixed palette of the pixel look: 45 hand-picked display (sRGB) colours in hue-shifted ramps, where
 * shadows lean cool and highlights lean warm, as pixel artists build them. Chosen for a grungy cyberpunk
 * night (deep blue-blacks, sodium amber, magenta and cyan neon) that still covers an overcast day (warm
 * concrete greys, muted greens, pale sky).
 */
export const PALETTE: readonly string[] = [
  // Cool night neutrals, black to moonlit white.
  '#06070b', '#0d1017', '#141923', '#1d2330', '#283041', '#364055', '#4a556c', '#636f87', '#828da3', '#a6aec0', '#cdd2dc', '#eef0f3',
  // Warm greys and browns: concrete, brick, wood, rust under lamplight and daylight.
  '#191311', '#2a201b', '#3e3029', '#56443a', '#71594b', '#907462', '#b2957d', '#d4bc9f', '#f1e3c8',
  // Olive greys: warm light on cool walls, so lamp pools fade out without jumping to green or blue.
  '#2c2922', '#47402f', '#6a6047',
  // Sodium and amber light.
  '#4b2513', '#7d3c16', '#b5591b', '#e2892b', '#f7b955', '#ffe29a',
  // Magenta neon.
  '#3b1234', '#781e61', '#c2358f', '#ff70c3',
  // Cyan neon and screens.
  '#0e3843', '#156d78', '#22b2ba', '#82f1ec',
  // Greens: plants, goggles, exit signs.
  '#1b301e', '#335c37', '#64994c', '#b6e46c',
  // Reds: alarm, blood, vending machines.
  '#3c0e13', '#7a1a21', '#c12f2e',
]

export type Lab = [number, number, number]

function toLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

/** OKLab from display (sRGB) values 0..1. A perceptual space, so "nearest" means "looks closest". */
export function oklab(r: number, g: number, b: number): Lab {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)]
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16)
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255]
}

/**
 * Index of the closest palette colour. Lightness counts a little more than hue, because a pixel that lands
 * on the right brightness but a slightly wrong hue still reads, while the reverse looks like noise.
 */
export function nearestIndex(colour: Lab, palette: readonly Lab[]): number {
  let best = 0
  let bestDistance = Infinity
  for (let index = 0; index < palette.length; index += 1) {
    const [l, a, b] = palette[index]
    const distance = 1.6 * (colour[0] - l) ** 2 + (colour[1] - a) ** 2 + (colour[2] - b) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return best
}

/** Cells per side of the look-up cube. 32 levels per channel is finer than any gap in the palette. */
export const LUT_SIZE = 32

/**
 * A 3D texture answering "nearest palette colour" for any display colour, so the shader quantises with a
 * single texture read instead of comparing against every palette entry.
 */
export function bakePaletteLut(palette: readonly string[] = PALETTE): Data3DTexture {
  const rgb = palette.map(hexToRgb)
  const lab = rgb.map(([r, g, b]) => oklab(r, g, b))
  const data = new Uint8Array(LUT_SIZE ** 3 * 4)
  for (let b = 0; b < LUT_SIZE; b += 1) {
    for (let g = 0; g < LUT_SIZE; g += 1) {
      for (let r = 0; r < LUT_SIZE; r += 1) {
        const step = LUT_SIZE - 1
        const [pr, pg, pb] = rgb[nearestIndex(oklab(r / step, g / step, b / step), lab)]
        const at = ((b * LUT_SIZE + g) * LUT_SIZE + r) * 4
        data.set([Math.round(pr * 255), Math.round(pg * 255), Math.round(pb * 255), 255], at)
      }
    }
  }
  const texture = new Data3DTexture(data, LUT_SIZE, LUT_SIZE, LUT_SIZE)
  texture.format = RGBAFormat
  texture.type = UnsignedByteType
  // The shader reads and writes display values directly, so no colour conversion may happen on the way.
  texture.colorSpace = LinearSRGBColorSpace
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.unpackAlignment = 1
  texture.needsUpdate = true
  return texture
}
