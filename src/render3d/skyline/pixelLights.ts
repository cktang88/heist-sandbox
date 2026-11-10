import type { LayerName } from './frame'
import type { Light } from './lights'
import { NEON } from './moods'
import { neonInks } from './pixelPaint'
import type { PixelMood } from './pixelMoods'
import { decodeSrgb, encodeSrgb } from './pipeline'
import { nearestInk, step, type Ink } from './pixelPalette'
import { hash3 } from './random'
import { hexToRgb } from '../style/palette'

/**
 * Out-of-focus lights for the pixel look: flat discs of a few art pixels with a one-step darker rim, as a
 * pixel artist draws bokeh. Bigger on nearer layers and fewer of them, so the near layer does not fight
 * the game for attention.
 */
export type PixelLight = Light & { body: Ink; rim: Ink; size: number }

/** Disc diameter in art pixels per layer (odd sizes have a centre pixel). */
const SIZE: Record<LayerName, readonly [number, number]> = { far: [5, 5], mid: [7, 7], near: [9, 9] }

const AVIATION = '#ff2a1a'

/** The palette ink a light's colour shows as, dimmed by its strength. */
function inkFor(light: Light): Ink {
  const neon = NEON.indexOf(light.colour as (typeof NEON)[number])
  if (neon >= 0) return neonInks(neon)[light.strength > 0.42 ? 0 : 1]
  if (light.colour === AVIATION) return 44
  const level = Math.min(1, 0.45 + light.strength * 1.4)
  return nearestInk(hexToRgb(light.colour).map((c) => encodeSrgb(decodeSrgb(c) * level)) as [number, number, number])
}

export function pixelLights(lights: readonly Light[], layer: LayerName, mood: PixelMood): PixelLight[] {
  const share = mood.discs[layer]
  const [small, large] = SIZE[layer]
  return lights
    .filter((light, index) => light.kind === 'blink' || light.kind === 'flying' || hash3(index, 17, layer.length) < share)
    .map((light, index) => {
      const body = inkFor(light)
      const beacon = light.kind === 'blink' || light.kind === 'flying'
      const size = beacon ? Math.max(1, small - 2) : hash3(index, 29, 3) < 0.3 || light.hex ? large : small
      return { ...light, body, rim: step(body, -1), size }
    })
}
