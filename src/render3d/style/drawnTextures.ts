import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat, UnsignedByteType } from 'three'
import { cellHash, fractalNoise } from '../noise'

/**
 * Hand-drawn media generated once at start-up, so the sketch and paint looks need no image files:
 * pencil hatching at four tones, and a paper/canvas surface. Both tile seamlessly.
 */

const HATCH_SIZE = 512

type Stroke = { count: number; angle: number; jitter: number; width: number; alpha: number; length: [number, number] }

/**
 * Four tones of pencil hatching, each one drawn over the previous (a "tonal art map"), so moving from one tone
 * to the next only adds strokes and never makes existing ones jump. Light tones are long, sparse diagonal
 * strokes; darker tones add more of them, then a cross-hatch, then dense short scribble.
 */
const TONES: Stroke[][] = [
  [{ count: 140, angle: -0.95, jitter: 0.06, width: 1.1, alpha: 0.5, length: [50, 130] }],
  [{ count: 260, angle: -0.95, jitter: 0.07, width: 1.2, alpha: 0.6, length: [40, 120] }],
  [{ count: 330, angle: 0.62, jitter: 0.08, width: 1.2, alpha: 0.62, length: [40, 110] }],
  [
    { count: 520, angle: -0.95, jitter: 0.1, width: 1.5, alpha: 0.75, length: [25, 80] },
    { count: 380, angle: 0.15, jitter: 0.12, width: 1.4, alpha: 0.7, length: [20, 60] },
  ],
]

function drawStroke(c: CanvasRenderingContext2D, x: number, y: number, stroke: Stroke, seed: number): void {
  const angle = stroke.angle + (cellHash(seed, 1, 31) - 0.5) * 2 * stroke.jitter
  const length = stroke.length[0] + cellHash(seed, 2, 31) * (stroke.length[1] - stroke.length[0])
  const dx = Math.cos(angle) * length
  const dy = Math.sin(angle) * length
  // A slight bow, as a wrist makes, and pressure that varies stroke to stroke.
  const bow = (cellHash(seed, 3, 31) - 0.5) * length * 0.08
  c.globalAlpha = stroke.alpha * (0.6 + 0.4 * cellHash(seed, 4, 31))
  c.lineWidth = stroke.width * (0.75 + 0.5 * cellHash(seed, 5, 31))
  // Drawn at every wrap-around offset, so the texture tiles.
  for (const ox of [-HATCH_SIZE, 0, HATCH_SIZE]) {
    for (const oy of [-HATCH_SIZE, 0, HATCH_SIZE]) {
      c.beginPath()
      c.moveTo(x + ox, y + oy)
      c.quadraticCurveTo(x + ox + dx / 2 - dy / length * bow, y + oy + dy / 2 + dx / length * bow, x + ox + dx, y + oy + dy)
      c.stroke()
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
  let seed = 0
  TONES.forEach((strokes, tone) => {
    for (const stroke of strokes) {
      for (let index = 0; index < stroke.count; index += 1) {
        seed += 1
        drawStroke(c, cellHash(seed, 7, 3) * HATCH_SIZE, cellHash(seed, 8, 3) * HATCH_SIZE, stroke, seed)
      }
    }
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
