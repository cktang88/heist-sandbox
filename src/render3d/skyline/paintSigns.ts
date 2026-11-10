import type { Mapping } from './atlas'
import { css, mix, scale } from './colour'
import type { Layer, Sign } from './layout'
import { NEON, type Mood } from './moods'
import { createRng, type Rng } from './random'

/**
 * Neon on the distant buildings: vertical strips of invented glyphs, shop boards, ad screens and corporate
 * emblems. No real brands or words; at this distance and blur they only need to read as "signs".
 */

/** Strokes on a 3 x 3 grid that combine into made-up characters, a little like kanji seen from far away. */
const STROKES: readonly (readonly [number, number, number, number])[] = [
  [0, 0, 1, 0], [0, 0.5, 1, 0.5], [0, 1, 1, 1], [0, 0, 0, 1], [0.5, 0, 0.5, 1], [1, 0, 1, 1],
  [0, 0, 1, 1], [1, 0, 0, 1], [0.2, 0.25, 0.8, 0.25], [0.5, 0.5, 0.1, 1], [0.5, 0.5, 0.9, 1], [0, 0.75, 1, 0.75],
]

function glyph(c: CanvasRenderingContext2D, rng: Rng, x: number, y: number, size: number): void {
  c.beginPath()
  const count = 2 + Math.floor(rng.range(0, 3))
  for (let stroke = 0; stroke < count; stroke += 1) {
    const [x0, y0, x1, y1] = rng.pick(STROKES)
    c.moveTo(x + x0 * size, y + y0 * size)
    c.lineTo(x + x1 * size, y + y1 * size)
  }
  c.stroke()
}

function glyphRow(c: CanvasRenderingContext2D, rng: Rng, x0: number, y0: number, x1: number, y1: number, vertical: boolean): void {
  const thick = vertical ? x1 - x0 : y1 - y0
  const size = thick * 0.62
  const step = size * 1.35
  const length = vertical ? y1 - y0 : x1 - x0
  const count = Math.max(1, Math.floor((length - thick * 0.3) / step))
  const start = (length - count * step) / 2 + (step - size) / 2
  c.lineWidth = Math.max(0.7, size * 0.16)
  for (let index = 0; index < count; index += 1) {
    const along = start + index * step
    if (vertical) glyph(c, rng, x0 + (thick - size) / 2, y0 + along, size)
    else glyph(c, rng, x0 + along, y0 + (thick - size) / 2, size)
  }
}

function screen(c: CanvasRenderingContext2D, rng: Rng, x: number, y: number, w: number, h: number, colour: string, alpha: number): void {
  const other = NEON[(NEON.indexOf(colour as (typeof NEON)[number]) + 3) % NEON.length]
  const fill = c.createLinearGradient(x, y, x + w, y + h)
  fill.addColorStop(0, css(scale(colour, 0.42), alpha))
  fill.addColorStop(1, css(scale(other, 0.32), alpha))
  c.fillStyle = fill
  c.fillRect(x, y, w, h)
  // An abstract advert: a face-like disc or a product shape, and a line of text.
  c.fillStyle = css(mix(colour, '#ffffff', 0.3), alpha * 0.55)
  c.beginPath()
  c.arc(x + w * rng.range(0.25, 0.75), y + h * 0.42, h * rng.range(0.18, 0.3), 0, Math.PI * 2)
  c.fill()
  c.fillRect(x + w * 0.12, y + h * 0.78, w * rng.range(0.3, 0.7), Math.max(1, h * 0.08))
}

function logo(c: CanvasRenderingContext2D, rng: Rng, x: number, y: number, size: number, colour: string, alpha: number): void {
  const [cx, cy, r] = [x + size / 2, y + size / 2, size * 0.42]
  c.strokeStyle = css(colour, alpha)
  c.lineWidth = Math.max(1, size * 0.09)
  c.beginPath()
  const sides = rng.pick([0, 3, 6])
  if (sides === 0) c.arc(cx, cy, r, 0, Math.PI * 2)
  else for (let corner = 0; corner <= sides; corner += 1) {
    const angle = (corner / sides) * Math.PI * 2 - Math.PI / 2
    c.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r)
  }
  c.stroke()
  c.fillStyle = css(colour, alpha)
  c.fillRect(cx - r * 0.5, cy - r * 0.12, r, r * 0.24)
  c.fillRect(cx - r * 0.12, cy - r * 0.5, r * 0.24, r)
}

function paintSign(c: CanvasRenderingContext2D, map: Mapping, sign: Sign, mood: Mood, dim: number, wall: string): void {
  const rng = createRng(sign.seed)
  const colour = NEON[sign.colour]
  const [x0, x1] = [map.x(sign.x0), map.x(sign.x1)]
  const [y0, y1] = [map.y(sign.y1), map.y(sign.y0)]
  const [w, h] = [x1 - x0, y1 - y0]
  const lit = mood.neon * dim
  if (sign.kind === 'screen') {
    screen(c, rng, x0, y0, w, h, colour, 0.3 + 0.35 * Math.max(lit, 0.4))
    return
  }
  if (sign.kind === 'logo') {
    logo(c, rng, x0, y0, Math.min(w, h), lit > 0.3 ? colour : css(mix(colour, wall, 0.8)), 0.25 + 0.65 * lit)
    return
  }
  // Boards: dark at night so the tubes glow; by day a painted panel in the sign's colour.
  c.fillStyle = lit > 0.3 ? css(scale(wall, 0.5), 0.92) : css(mix(colour, wall, 0.75), 0.95)
  c.fillRect(x0, y0, w, h)
  c.strokeStyle = lit > 0.3 ? css(mix(colour, '#ffffff', 0.25), 0.4 + 0.6 * lit) : css(mix('#f0ece4', wall, 0.4), 0.8)
  glyphRow(c, rng, x0, y0, x1, y1, sign.kind === 'vertical')
  if (lit > 0.3) {
    c.strokeStyle = css(colour, 0.5 * lit)
    c.lineWidth = Math.max(0.6, Math.min(w, h) * 0.06)
    c.strokeRect(x0 + c.lineWidth, y0 + c.lineWidth, w - 2 * c.lineWidth, h - 2 * c.lineWidth)
  }
}

/** All signs of a layer, on top of the hazed buildings so the neon stays vivid. */
export function paintSigns(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, mood: Mood, wall: string): void {
  const dim = 0.75 - layer.spec.haze * 0.3
  for (const building of layer.buildings) for (const sign of building.signs) paintSign(c, map, sign, mood, dim, wall)
}

/** Light spilling into the air around each sign: a wide, faint glow, painted after the blur. */
export function paintGlows(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, mood: Mood, offsetX: number, offsetY: number): void {
  if (mood.neon < 0.3) return
  c.save()
  c.globalCompositeOperation = 'lighter'
  const strength = 0.13 * mood.neon * (1 - layer.spec.haze * 0.4)
  for (const building of layer.buildings) {
    for (const sign of building.signs) {
      const cx = offsetX + map.x((sign.x0 + sign.x1) / 2)
      const cy = offsetY + map.y((sign.y0 + sign.y1) / 2)
      const radius = Math.max(map.x(sign.x1) - map.x(sign.x0), map.y(sign.y0) - map.y(sign.y1)) * 0.8 + 4 * map.scaleX
      const glow = c.createRadialGradient(cx, cy, 0, cx, cy, radius)
      const colour = NEON[sign.colour]
      glow.addColorStop(0, css(colour, strength))
      glow.addColorStop(0.4, css(colour, strength * 0.35))
      glow.addColorStop(1, css(colour, 0))
      c.fillStyle = glow
      c.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
    }
  }
  c.restore()
}
