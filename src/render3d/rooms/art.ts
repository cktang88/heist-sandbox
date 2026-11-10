import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import type { TimeOfDay } from '../../game/site'
import { cellHash } from '../noise'

/** Texture corners (u0, v0, u1, v1) of one cell of an atlas, with row 0 at the top of the picture. */
export type Cell = [number, number, number, number]

export function cellOf(column: number, row: number, columns: number, rows: number): Cell {
  return [column / columns, 1 - (row + 1) / rows, (column + 1) / columns, 1 - row / rows]
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  return [element, element.getContext('2d')!]
}

function textureOf(element: HTMLCanvasElement, repeat = false): CanvasTexture {
  const texture = new CanvasTexture(element)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

// ---------------------------------------------------------------- windows

/** What a window can show. Rooms pick among these; the picture depends on the time of day. */
export type View = 'clear' | 'clearFar' | 'blindsHalf' | 'blindsDown' | 'frosted' | 'barred' | 'louvre' | 'neon'
const VIEWS: readonly View[] = ['clear', 'clearFar', 'blindsHalf', 'blindsDown', 'frosted', 'barred', 'louvre', 'neon']
const VIEW_CELL = 256

export function viewCell(view: View): Cell {
  const index = VIEWS.indexOf(view)
  return cellOf(index % 4, Math.floor(index / 4), 4, 2)
}

type Palette = { top: string; bottom: string; far: string; near: string; lit: readonly string[]; litOdds: number; glass: string; slat: string }

const NIGHT: Palette = {
  top: '#05081a', bottom: '#241c38', far: '#141828', near: '#0a0d18',
  lit: ['#d89a50', '#e0b070', '#7a9ccc', '#c8784a'], litOdds: 0.14, glass: 'rgba(160,190,255,0.08)', slat: '#8a7c68',
}
const DAY: Palette = {
  top: '#a4aebb', bottom: '#d6d9dc', far: '#aab1b8', near: '#7a838c',
  lit: ['#4a5260', '#3e4654', '#5a6270'], litOdds: 0.5, glass: 'rgba(255,255,255,0.22)', slat: '#d4cec0',
}

/** A city seen through glass: sky, two rows of buildings with windows, and a sheen across the pane. */
function paintOutside(c: CanvasRenderingContext2D, x0: number, y0: number, p: Palette, seed: number): void {
  const size = VIEW_CELL
  const sky = c.createLinearGradient(0, y0, 0, y0 + size)
  sky.addColorStop(0, p.top)
  sky.addColorStop(1, p.bottom)
  c.fillStyle = sky
  c.fillRect(x0, y0, size, size)
  for (const [row, colour, low, high, step] of [[0, p.far, 0.45, 0.72, 14], [1, p.near, 0.25, 0.6, 26]] as const) {
    let x = x0
    for (let index = 0; x < x0 + size; index += 1) {
      const width = 40 + cellHash(index, row, seed) * 70
      const top = y0 + size * (low + cellHash(index, row + 7, seed) * (high - low))
      c.fillStyle = colour
      c.fillRect(x, top, width, y0 + size - top)
      for (let wy = top + 5; wy < y0 + size - 3; wy += step) {
        for (let wx = x + 4; wx < x + width - 4; wx += step) {
          const roll = cellHash(Math.round(wx), Math.round(wy), seed + row)
          if (roll > p.litOdds * (row === 0 ? 0.7 : 1)) continue
          c.fillStyle = p.lit[Math.floor(roll * 997) % p.lit.length]
          c.fillRect(wx, wy, step * 0.45, step * 0.5)
        }
      }
      x += width + 2
    }
  }
  const sheen = c.createLinearGradient(x0, y0, x0 + size, y0 + size)
  sheen.addColorStop(0.3, 'rgba(255,255,255,0)')
  sheen.addColorStop(0.42, p.glass)
  sheen.addColorStop(0.5, 'rgba(255,255,255,0)')
  c.fillStyle = sheen
  c.fillRect(x0, y0, size, size)
}

function paintBlinds(c: CanvasRenderingContext2D, x0: number, y0: number, p: Palette, fraction: number): void {
  const bottom = y0 + VIEW_CELL * fraction
  for (let y = y0; y < bottom; y += 10) {
    c.fillStyle = p.slat
    c.fillRect(x0, y, VIEW_CELL, 8)
    c.fillStyle = 'rgba(0,0,0,0.35)'
    c.fillRect(x0, y + 7, VIEW_CELL, 2)
  }
  c.fillStyle = '#3a3a3a'
  c.fillRect(x0, bottom - 4, VIEW_CELL, 5)
  // The pull cord.
  c.fillRect(x0 + VIEW_CELL * 0.85, y0, 2, Math.min(y0 + VIEW_CELL, bottom + 40) - y0)
}

function paintView(c: CanvasRenderingContext2D, view: View, x0: number, y0: number, p: Palette, night: boolean): void {
  const seed = VIEWS.indexOf(view) * 13 + 3
  if (view === 'frosted') {
    const glow = c.createLinearGradient(0, y0, 0, y0 + VIEW_CELL)
    glow.addColorStop(0, night ? '#2a3448' : '#d8dee6')
    glow.addColorStop(1, night ? '#3a3a50' : '#c4ccd4')
    c.fillStyle = glow
    c.fillRect(x0, y0, VIEW_CELL, VIEW_CELL)
    for (let blob = 0; blob < 6; blob += 1) {
      const bx = x0 + cellHash(blob, 1, 4) * VIEW_CELL
      const by = y0 + cellHash(blob, 2, 4) * VIEW_CELL
      const soft = c.createRadialGradient(bx, by, 0, bx, by, 60)
      soft.addColorStop(0, night ? 'rgba(255,180,100,0.25)' : 'rgba(255,255,255,0.4)')
      soft.addColorStop(1, 'rgba(0,0,0,0)')
      c.fillStyle = soft
      c.fillRect(x0, y0, VIEW_CELL, VIEW_CELL)
    }
    return
  }
  if (view === 'louvre') {
    c.fillStyle = night ? '#141820' : '#8a929a'
    c.fillRect(x0, y0, VIEW_CELL, VIEW_CELL)
    for (let y = y0; y < y0 + VIEW_CELL; y += 16) {
      c.fillStyle = night ? '#3a4048' : '#5a6068'
      c.fillRect(x0, y, VIEW_CELL, 10)
      c.fillStyle = night ? '#4a525c' : '#7a828a'
      c.fillRect(x0, y, VIEW_CELL, 2)
    }
    return
  }
  paintOutside(c, x0, y0, p, view === 'clearFar' ? seed + 50 : seed)
  if (view === 'blindsHalf') paintBlinds(c, x0, y0, p, 0.5)
  if (view === 'blindsDown') paintBlinds(c, x0, y0, p, 0.85)
  if (view === 'barred') {
    c.fillStyle = '#16181c'
    for (let x = x0 + 14; x < x0 + VIEW_CELL; x += 36) c.fillRect(x, y0, 9, VIEW_CELL)
  }
  if (view === 'neon') {
    const bx = x0 + VIEW_CELL * 0.8
    const glow = c.createRadialGradient(bx, y0 + VIEW_CELL * 0.4, 0, bx, y0 + VIEW_CELL * 0.4, VIEW_CELL * 0.7)
    glow.addColorStop(0, night ? 'rgba(255,45,149,0.55)' : 'rgba(224,83,58,0.2)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = glow
    c.fillRect(x0, y0, VIEW_CELL, VIEW_CELL)
    c.fillStyle = night ? '#ff4fb0' : '#c84a3a'
    c.fillRect(bx - 6, y0 + 30, 12, VIEW_CELL * 0.6)
  }
}

/** Every window picture for one time of day, painted once into a single atlas. */
export function windowAtlas(time: TimeOfDay): CanvasTexture {
  const [element, c] = canvas(VIEW_CELL * 4, VIEW_CELL * 2)
  const night = time === 'night'
  VIEWS.forEach((view, index) => paintView(c, view, (index % 4) * VIEW_CELL, Math.floor(index / 4) * VIEW_CELL, night ? NIGHT : DAY, night))
  return textureOf(element)
}

// ---------------------------------------------------------------- ceramic tiles

/** Small square wall tiles with grout lines: colour (white, tinted per room) and a matching bump map. */
export function ceramicTextures(): { color: CanvasTexture; normal: CanvasTexture } {
  const size = 512
  const tile = 64
  const [colorCanvas, c] = canvas(size, size)
  const [normalCanvas, n] = canvas(size, size)
  c.fillStyle = '#9a9a96'
  c.fillRect(0, 0, size, size)
  n.fillStyle = '#8080ff'
  n.fillRect(0, 0, size, size)
  for (let y = 0; y < size; y += tile) {
    for (let x = 0; x < size; x += tile) {
      const shade = 232 + Math.round(cellHash(x, y, 5) * 18)
      c.fillStyle = `rgb(${shade},${shade},${shade - 4})`
      c.fillRect(x + 3, y + 3, tile - 5, tile - 5)
      // Bevelled edges: left and top lean one way, right and bottom the other.
      n.fillStyle = '#5080ff'
      n.fillRect(x + 3, y + 3, 3, tile - 5)
      n.fillStyle = '#b080ff'
      n.fillRect(x + tile - 5, y + 3, 3, tile - 5)
      n.fillStyle = '#80b0ff'
      n.fillRect(x + 3, y + 3, tile - 5, 3)
      n.fillStyle = '#8050ff'
      n.fillRect(x + 3, y + tile - 5, tile - 5, 3)
    }
  }
  const color = textureOf(colorCanvas, true)
  const normal = new CanvasTexture(normalCanvas)
  normal.wrapS = normal.wrapT = RepeatWrapping
  return { color, normal }
}

// ---------------------------------------------------------------- lettering

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
const GLYPH_COLUMNS = 8
const GLYPH_ROWS = 5
const GLYPH_CELL = 96

/** Distance from one letter to the next as a share of letter height. */
export const GLYPH_ASPECT = 0.56

export function glyphCell(letter: string): Cell | null {
  const index = GLYPHS.indexOf(letter)
  if (index < 0) return null
  return cellOf(index % GLYPH_COLUMNS, Math.floor(index / GLYPH_COLUMNS), GLYPH_COLUMNS, GLYPH_ROWS)
}

/** White block letters on transparent, tinted per use: floor numbers, bay numbers, signs. */
export function glyphAtlas(): CanvasTexture {
  const [element, c] = canvas(GLYPH_CELL * GLYPH_COLUMNS, GLYPH_CELL * GLYPH_ROWS)
  c.fillStyle = '#ffffff'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `bold ${GLYPH_CELL * 0.9}px "DejaVu Sans Condensed", "Arial Narrow", sans-serif`
  for (let index = 0; index < GLYPHS.length; index += 1) {
    const x = (index % GLYPH_COLUMNS) * GLYPH_CELL + GLYPH_CELL / 2
    const y = Math.floor(index / GLYPH_COLUMNS) * GLYPH_CELL + GLYPH_CELL / 2
    c.save()
    c.translate(x, y)
    c.scale(0.72, 1)
    c.fillText(GLYPHS[index], 0, 4)
    c.restore()
  }
  return textureOf(element)
}

// ---------------------------------------------------------------- company sign

export const COMPANY = 'BLACKMOOR'

/** The company name with a mark beside it, white on transparent, for the lobby wall and the roof sign. */
export function logoTexture(): CanvasTexture {
  const [element, c] = canvas(1024, 256)
  c.strokeStyle = '#ffffff'
  c.lineWidth = 14
  c.beginPath()
  c.moveTo(70, 200)
  c.lineTo(128, 50)
  c.lineTo(186, 200)
  c.moveTo(98, 140)
  c.lineTo(158, 140)
  c.stroke()
  c.beginPath()
  c.arc(128, 128, 104, 0, Math.PI * 2)
  c.stroke()
  c.fillStyle = '#ffffff'
  c.textBaseline = 'middle'
  c.font = 'bold 150px "DejaVu Sans", sans-serif'
  // Squeeze the name to fit beside the mark, whatever font the browser supplies.
  const room = 1024 - 270
  c.save()
  c.translate(258, 136)
  c.scale(Math.min(0.9, room / c.measureText(COMPANY).width), 1)
  c.fillText(COMPANY, 0, 0)
  c.restore()
  return textureOf(element)
}

// ---------------------------------------------------------------- wear and markings

/** Yellow and black warning stripes, repeating. */
export function hazardTexture(): CanvasTexture {
  const [element, c] = canvas(128, 128)
  c.fillStyle = '#e0b020'
  c.fillRect(0, 0, 128, 128)
  c.fillStyle = '#151515'
  for (let offset = -128; offset < 256; offset += 64) {
    c.beginPath()
    c.moveTo(offset, 128)
    c.lineTo(offset + 32, 128)
    c.lineTo(offset + 160, 0)
    c.lineTo(offset + 128, 0)
    c.fill()
  }
  return textureOf(element, true)
}

export const SCUFF_CELL = cellOf(0, 0, 2, 1)
export const STAIN_CELL = cellOf(1, 0, 2, 1)

/**
 * Dirt as see-through dark marks: the left half is a band of scuffs and grime that gathers at the foot of a wall,
 * the right half is a water stain running down from a ceiling leak.
 */
export function grimeTexture(): CanvasTexture {
  const [element, c] = canvas(512, 256)
  const foot = c.createLinearGradient(0, 256, 0, 0)
  foot.addColorStop(0, 'rgba(20,16,10,0.75)')
  foot.addColorStop(0.35, 'rgba(20,16,10,0.25)')
  foot.addColorStop(1, 'rgba(20,16,10,0)')
  c.fillStyle = foot
  c.fillRect(0, 0, 256, 256)
  for (let mark = 0; mark < 40; mark += 1) {
    c.fillStyle = `rgba(10,8,6,${0.1 + cellHash(mark, 1, 3) * 0.25})`
    c.fillRect(cellHash(mark, 2, 3) * 256, 150 + cellHash(mark, 3, 3) * 90, 6 + cellHash(mark, 4, 3) * 30, 2 + cellHash(mark, 5, 3) * 4)
  }
  for (let streak = 0; streak < 9; streak += 1) {
    const x = 300 + cellHash(streak, 1, 8) * 170
    const length = 80 + cellHash(streak, 2, 8) * 170
    const run = c.createLinearGradient(0, 0, 0, length)
    run.addColorStop(0, 'rgba(60,44,20,0.55)')
    run.addColorStop(1, 'rgba(60,44,20,0)')
    c.fillStyle = run
    c.fillRect(x, 0, 4 + cellHash(streak, 3, 8) * 10, length)
  }
  const blot = c.createRadialGradient(384, 0, 0, 384, 0, 110)
  blot.addColorStop(0, 'rgba(70,52,24,0.5)')
  blot.addColorStop(1, 'rgba(70,52,24,0)')
  c.fillStyle = blot
  c.fillRect(256, 0, 256, 120)
  return textureOf(element)
}

/** A soft-edged blob, white on transparent: puddles and light pools take their shape from it. */
export function blobTexture(): CanvasTexture {
  const [element, c] = canvas(128, 128)
  const soft = c.createRadialGradient(64, 64, 10, 64, 64, 62)
  soft.addColorStop(0, 'rgba(255,255,255,1)')
  soft.addColorStop(0.7, 'rgba(255,255,255,0.85)')
  soft.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = soft
  c.fillRect(0, 0, 128, 128)
  return textureOf(element)
}
