import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three'
import { cellHash, fractalNoise } from '../noise'

/**
 * Hand-drawn media generated once at start-up, so the sketch and paint looks need no image files:
 * pencil hatching at four tones, and a paper/canvas surface. Both tile seamlessly.
 */

const HATCH_SIZE = 512

/**
 * One layer of hatching: parallel pencil lines across the tile, broken into strokes of varying length and
 * pressure with small gaps, the way an artist hatches a tone. Lines run at 45 degrees (or flat), with a spacing
 * that divides the tile, so the pattern repeats without a seam.
 */
type Layer = { direction: 1 | -1 | 0; spacing: number; offset: number; width: number; alpha: number }

/**
 * Four tones of hatching, each drawn over the previous (a "tonal art map"), so moving from one tone to the
 * next only adds lines and never makes existing ones jump: single diagonal hatch, denser hatch, cross-hatch,
 * then a third flat direction for near black.
 */
const TONES: Layer[][] = [
  [{ direction: 1, spacing: 16, offset: 0, width: 1.6, alpha: 0.85 }],
  [{ direction: 1, spacing: 16, offset: 8, width: 1.5, alpha: 0.8 }],
  [{ direction: -1, spacing: 16, offset: 3, width: 1.5, alpha: 0.8 }],
  [
    { direction: -1, spacing: 16, offset: 11, width: 1.6, alpha: 0.85 },
    { direction: 0, spacing: 8, offset: 2, width: 1.4, alpha: 0.75 },
  ],
]

function drawLayer(c: CanvasRenderingContext2D, layer: Layer, seed: number): void {
  const lines = HATCH_SIZE / layer.spacing
  // Along a 45-degree line the tile repeats every HATCH_SIZE * sqrt(2); flat lines repeat every HATCH_SIZE.
  const along = layer.direction === 0 ? HATCH_SIZE : HATCH_SIZE * Math.SQRT2
  const unit = layer.direction === 0 ? [1, 0] : [Math.SQRT1_2, layer.direction * Math.SQRT1_2]
  for (let line = 0; line < lines; line += 1) {
    const offset = line * layer.spacing + layer.offset
    // Start of the line: on the left edge for flat lines, on the top or bottom edge for diagonals.
    const start = layer.direction === 0 ? [0, offset] : [offset, layer.direction === 1 ? 0 : HATCH_SIZE]
    let t = cellHash(line, seed, 9) * 30
    for (let stroke = 0; t < along; stroke += 1) {
      const hash = (k: number) => cellHash(line * 131 + stroke, seed, k)
      const length = 30 + hash(1) * 110
      const wander = (hash(2) - 0.5) * 2.2
      c.globalAlpha = layer.alpha * (0.55 + 0.45 * hash(3))
      c.lineWidth = layer.width * (0.8 + 0.4 * hash(4))
      const x0 = start[0] + unit[0] * t
      const y0 = start[1] + unit[1] * t
      const x1 = x0 + unit[0] * length - unit[1] * wander
      const y1 = y0 + unit[1] * length + unit[0] * wander
      for (const ox of [-HATCH_SIZE, 0, HATCH_SIZE]) {
        for (const oy of [-HATCH_SIZE, 0, HATCH_SIZE]) {
          c.beginPath()
          c.moveTo(x0 + ox, y0 + oy)
          c.lineTo(x1 + ox, y1 + oy)
          c.stroke()
        }
      }
      t += length + 3 + hash(5) * 22
    }
  }
}

export function hatchTexture(): DataTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = HATCH_SIZE
  const c = canvas.getContext('2d', { willReadFrequently: true })!
  c.fillStyle = '#fff'
  c.fillRect(0, 0, HATCH_SIZE, HATCH_SIZE)
  c.strokeStyle = '#000'
  c.lineCap = 'round'
  const data = new Uint8Array(HATCH_SIZE * HATCH_SIZE * 4)
  TONES.forEach((layers, tone) => {
    layers.forEach((layer, index) => drawLayer(c, layer, tone * 7 + index + 1))
    const pixels = c.getImageData(0, 0, HATCH_SIZE, HATCH_SIZE).data
    for (let at = 0; at < HATCH_SIZE * HATCH_SIZE; at += 1) data[at * 4 + tone] = 255 - pixels[at * 4]
  })
  return tiled(new DataTexture(data, HATCH_SIZE, HATCH_SIZE, RGBAFormat, UnsignedByteType))
}

const PAPER_SIZE = 512

/**
 * Red: paper or canvas tooth (soft blotches plus fine grain and fibres). Green and blue: two smooth noise
 * fields, used to make lines and strokes wobble like a hand-drawn frame.
 */
export function paperTexture(): DataTexture {
  const data = new Uint8Array(PAPER_SIZE * PAPER_SIZE * 4)
  for (let y = 0; y < PAPER_SIZE; y += 1) {
    for (let x = 0; x < PAPER_SIZE; x += 1) {
      const u = x / PAPER_SIZE
      const v = y / PAPER_SIZE
      const blotch = fractalNoise(u, v, 4, 11, 4)
      const grain = cellHash(x, y, 5)
      const tooth = 0.55 * blotch + 0.45 * grain
      const at = (y * PAPER_SIZE + x) * 4
      data[at] = Math.round(255 * tooth)
      data[at + 1] = Math.round(255 * fractalNoise(u, v, 6, 21, 3))
      data[at + 2] = Math.round(255 * fractalNoise(u, v, 6, 37, 3))
      data[at + 3] = 255
    }
  }
  // Fibres: short faint streaks pressed into the sheet.
  for (let fibre = 0; fibre < 900; fibre += 1) {
    const x0 = cellHash(fibre, 1, 77) * PAPER_SIZE
    const y0 = cellHash(fibre, 2, 77) * PAPER_SIZE
    const angle = cellHash(fibre, 3, 77) * Math.PI
    const length = 6 + cellHash(fibre, 4, 77) * 18
    const shade = cellHash(fibre, 5, 77) > 0.5 ? 40 : -40
    for (let step = 0; step < length; step += 1) {
      const x = Math.floor(x0 + Math.cos(angle) * step + PAPER_SIZE) % PAPER_SIZE
      const y = Math.floor(y0 + Math.sin(angle) * step + PAPER_SIZE) % PAPER_SIZE
      const at = (y * PAPER_SIZE + x) * 4
      data[at] = Math.max(0, Math.min(255, data[at] + shade))
    }
  }
  return tiled(new DataTexture(data, PAPER_SIZE, PAPER_SIZE, RGBAFormat, UnsignedByteType))
}

function tiled(texture: DataTexture): DataTexture {
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.magFilter = LinearFilter
  texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}
