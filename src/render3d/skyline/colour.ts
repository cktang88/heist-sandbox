/** Display (sRGB) colour helpers for the canvas painters. Channels are 0..255. */
export type Rgb = readonly [number, number, number]

export function rgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

/** `t` = 0 gives `a`, 1 gives `b`. */
export function mix(a: string | Rgb, b: string | Rgb, t: number): Rgb {
  const [ca, cb] = [typeof a === 'string' ? rgb(a) : a, typeof b === 'string' ? rgb(b) : b]
  return [ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]
}

/** Brighter or darker by a factor, keeping the hue. */
export function scale(colour: string | Rgb, factor: number): Rgb {
  const c = typeof colour === 'string' ? rgb(colour) : colour
  return [Math.min(255, c[0] * factor), Math.min(255, c[1] * factor), Math.min(255, c[2] * factor)]
}

export function css(colour: string | Rgb, alpha = 1): string {
  const c = typeof colour === 'string' ? rgb(colour) : colour
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, alpha)).toFixed(3)})`
}
