import { context, makeCanvas } from './canvas'
import { windowIsWarm, windowLight, type Building, type Layer, type Roof, type Sign } from './layout'
import type { PixelSheet } from './pixelFrame'
import type { PixelLayerInks, PixelMood } from './pixelMoods'
import { step, type Ink } from './pixelPalette'
import { createRng, type Rng } from './random'

/**
 * Paints one layer of the city as pixel art: flat silhouettes with a lit edge, windows on a regular pixel
 * grid, bold signs, a flat haze band at the street. Every texel is one art pixel, and every texel holds a
 * palette index in its red channel (alpha 255 where painted), so nothing here may be anti-aliased: only
 * whole-texel rectangles are drawn.
 */

/** Neon colours of `NEON` (moods.ts) as bright and dim palette inks. */
const NEON_INKS: readonly (readonly [Ink, Ink])[] = [[33, 32], [36, 35], [28, 27], [32, 31], [44, 43], [41, 40], [36, 35], [33, 32]]

export function neonInks(colour: number): readonly [Ink, Ink] {
  return NEON_INKS[colour % NEON_INKS.length]
}

type Painter = {
  c: CanvasRenderingContext2D
  sheet: PixelSheet
  /** Texel column of a world x, texel row (from the top) of a world y. */
  x(world: number): number
  y(world: number): number
  /** Fills texels [x0, x1) x [y0, y1) (texel units, rows from the top). */
  fill(ink: Ink, x0: number, y0: number, x1: number, y1: number): void
  /** Call after changing the context's fill style or state by other means. */
  forget(): void
}

function painter(c: CanvasRenderingContext2D, sheet: PixelSheet, used: Set<Ink>): Painter {
  let current = -1
  return {
    c,
    sheet,
    x: (world) => Math.round((world - sheet.left) / sheet.texel),
    y: (world) => Math.round(sheet.height - (world - sheet.bottom) / sheet.texel),
    fill(ink, x0, y0, x1, y1) {
      if (ink !== current) {
        c.fillStyle = `rgb(${ink},0,0)`
        current = ink
        used.add(ink)
      }
      c.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0))
    },
    forget() {
      current = -1
    },
  }
}

/** A world-space rectangle, at least one texel each way. */
function block(p: Painter, ink: Ink, x0: number, y0: number, x1: number, y1: number): void {
  const [left, top] = [p.x(x0), p.y(y1)]
  p.fill(ink, left, top, Math.max(left + 1, p.x(x1)), Math.max(top + 1, p.y(y0)))
}

function paintRoof(p: Painter, roof: Roof, ink: Ink): void {
  const top = roof.base + roof.height
  switch (roof.kind) {
    case 'antenna': {
      const x = p.x(roof.x)
      p.fill(ink, x, p.y(top), x + 1, p.y(roof.base))
      if (roof.height > 10) p.fill(ink, x - 1, p.y(roof.base + roof.height * 0.6), x + 2, p.y(roof.base + roof.height * 0.6) + 1)
      break
    }
    case 'spire': {
      // A stepped point: each row a little narrower, as a pixel artist draws a needle.
      const middle = p.x(roof.x + roof.width / 2)
      const [rowTop, rowBase] = [p.y(top), p.y(roof.base)]
      for (let row = rowTop; row < rowBase; row += 1) {
        const half = Math.floor(((row - rowTop) / Math.max(1, rowBase - rowTop)) * 2.4 / p.sheet.texel)
        p.fill(ink, middle - half, row, middle + half + 1, row + 1)
      }
      break
    }
    case 'tank':
      block(p, ink, roof.x, roof.base + 1.2, roof.x + roof.width, top)
      block(p, ink, roof.x + 0.2, roof.base, roof.x + 0.2, roof.base + 1.2)
      block(p, ink, roof.x + roof.width - 0.4, roof.base, roof.x + roof.width - 0.4, roof.base + 1.2)
      break
    case 'crane': {
      const jibEnd = roof.x + roof.width
      const back = roof.x - roof.width * 0.3
      block(p, ink, roof.x, roof.base, roof.x + 0.9, top + 2)
      block(p, ink, Math.min(roof.x, jibEnd, back), top, Math.max(roof.x, jibEnd, back), top)
      block(p, ink, Math.min(back, back + Math.sign(roof.width) * 2), top - 1.6, Math.max(back, back + Math.sign(roof.width) * 2), top)
      const hook = roof.x + roof.width * 0.7
      block(p, ink, hook, top - roof.height * 0.5, hook, top)
      break
    }
    case 'billboard':
      block(p, ink, roof.x + 1, roof.base - 2.5, roof.x + 1.5, roof.base)
      block(p, ink, roof.x + roof.width - 1.5, roof.base - 2.5, roof.x + roof.width - 1, roof.base)
      break
    case 'chimney':
      block(p, ink, roof.x, roof.base, roof.x + roof.width, top)
      break
    case 'dish':
      block(p, ink, roof.x, roof.base, roof.x + roof.width, roof.base + 1.2)
      break
  }
}

/** Window cells on whole texels: same pitch on every floor, so the grid reads as clean pixel art. */
function paintWindows(p: Painter, layer: Layer, building: Building, mood: PixelMood, inks: PixelLayerInks, odds: number): void {
  const name = layer.spec.name
  const t = p.sheet.texel
  const pitchX = Math.max(2, Math.round(building.column / t))
  const pitchY = Math.max(3, Math.round(building.floor / t))
  const far = name === 'far'
  const w = Math.max(1, Math.min(pitchX - 1, far ? 1 : Math.round(pitchX * building.windowWide)))
  const h = Math.max(1, Math.min(pitchY - 2, far ? 2 : Math.round(pitchY * building.windowTall)))
  const groundRow = p.y(layer.ground)
  const glass = inks.glass
  let base = groundRow - Math.round(pitchY * 0.6)
  for (const tier of building.tiers) {
    const [x0, x1, top] = [p.x(tier.x0), p.x(tier.x1), p.y(tier.top)]
    const columns = Math.floor((x1 - x0 - 1) / pitchX)
    const inset = x0 + Math.floor((x1 - x0 - columns * pitchX) / 2) + Math.floor((pitchX - w) / 2)
    if (glass !== null && building.facade === 'curtain') {
      // A glass tower by day: the whole face is glass, split by thin mullions.
      p.fill(glass, x0 + 1, top + 2, x1 - 1, base)
      for (let column = 0; column <= columns; column += 1) p.fill(inks.wall, inset - 1 + column * pitchX, top + 2, inset + column * pitchX, base)
    }
    for (let floor = 0; ; floor += 1) {
      const bottom = groundRow - Math.round(pitchY * 0.6) - floor * pitchY
      const rowTop = bottom - h
      if (rowTop < top + 1) break
      if (bottom > base) continue
      for (let column = 0; column < columns; column += 1) {
        const cx = inset + column * pitchX
        const cell = {
          x: layer.sheet.left + (cx + w / 2) * t,
          y: layer.sheet.bottom + (p.sheet.height - bottom) * t,
          w: w * t,
          h: h * t,
          floor,
          column: Math.round((cx * t + p.sheet.left - building.x0) / building.column),
        }
        const lit = windowLight(building, cell, odds)
        let ink: Ink | null = null
        if (lit > 0) {
          const pair = windowIsWarm(building, cell) ? mood.warm[name] : mood.cold[name]
          ink = lit > 0.72 ? pair[0] : pair[1]
        } else if (glass !== null && building.facade === 'grid') ink = glass
        if (ink === null) continue
        p.fill(ink, cx, rowTop, cx + w, bottom)
        // Big near windows get a frame bar and a darker sill row, so they read as windows, not tiles.
        if (w >= 5) p.fill(inks.wall, cx + Math.floor(w / 2), rowTop, cx + Math.floor(w / 2) + 1, bottom)
        if (h >= 5 && lit > 0) p.fill(step(ink, -1), cx, bottom - 1, cx + w, bottom)
      }
    }
    base = top
  }
}

/** The building's body, roof clutter and lit edge, then its windows. */
function paintBuilding(p: Painter, layer: Layer, building: Building, mood: PixelMood, inks: PixelLayerInks, odds: number): void {
  const body = building.row === 0 && layer.buildings.some((b) => b.row > 0) ? inks.back : inks.wall
  const groundRow = p.y(layer.ground)
  for (const tier of building.tiers) p.fill(body, p.x(tier.x0), p.y(tier.top), p.x(tier.x1), groundRow + 1)
  for (const roof of building.roofs) paintRoof(p, roof, body)
  // Light from one side only, as pixel art shades it: a one-pixel lit edge down the left of each tier.
  for (const tier of building.tiers) p.fill(inks.rim, p.x(tier.x0), p.y(tier.top), p.x(tier.x0) + 1, groundRow)
  paintWindows(p, layer, building, mood, { ...inks, wall: body }, odds)
}

/** The elevated railway of the middle layer: deck and pillars, with a row of small lamps at night. */
function paintViaduct(p: Painter, layer: Layer, mood: PixelMood, inks: PixelLayerInks): void {
  if (layer.rail === null) return
  const [left, right] = [0, p.sheet.width]
  p.fill(inks.wall, left, p.y(layer.rail), right, p.y(layer.rail - 1.4))
  for (let x = layer.sheet.left + 6; x < layer.sheet.right; x += 16) block(p, inks.wall, x, layer.ground, x + 1.8, layer.rail - 1.4)
  if (mood.time !== 'night') return
  for (let x = layer.sheet.left + 3; x < layer.sheet.right; x += 8) block(p, mood.warm[layer.spec.name][1], x, layer.rail - 1.6, x, layer.rail - 1.6)
}

/** Shop windows glowing along the street at night. */
function paintShopfronts(p: Painter, layer: Layer, mood: PixelMood): void {
  if (mood.time !== 'night' || layer.spec.name === 'far') return
  const rng = createRng(layer.buildings.length * 17 + 3)
  const front = layer.buildings[layer.buildings.length - 1].row
  for (const building of layer.buildings) {
    if (building.row !== front) continue
    for (let x = building.x0 + 0.6; x < building.x1 - 3; x += rng.range(3, 7)) {
      if (!rng.chance(0.5)) continue
      const pair = mood.warm[layer.spec.name]
      block(p, rng.chance(0.3) ? pair[0] : pair[1], x, layer.ground + 0.4, x + rng.range(2, 4.5), layer.ground + 1.8)
    }
  }
}

/** A 2 x 2 pattern of one ink at the given share of texels (0.25, 0.5 or 0.75), for dithered edges. */
function pattern(c: CanvasRenderingContext2D, ink: Ink, share: number): CanvasPattern {
  const tile = makeCanvas(2, 2)
  const t = context(tile)
  t.fillStyle = `rgb(${ink},0,0)`
  const cells = share > 0.6 ? [[0, 0], [1, 1], [1, 0]] : share > 0.3 ? [[0, 0], [1, 1]] : [[0, 0]]
  for (const [x, y] of cells) t.fillRect(x, y, 1, 1)
  const result = c.createPattern(tile, 'repeat')
  if (!result) throw new Error('canvas pattern failed')
  return result
}

/**
 * The air thickening toward the street: a flat band of haze over the foot of every building, with a short
 * dithered edge above it (three rows: 75%, 50%, 25%) so it reads as air and not as a painted stripe.
 */
function paintHaze(p: Painter, layer: Layer, mood: PixelMood, inks: PixelLayerInks): void {
  const c = p.c
  const top = p.y(layer.ground + mood.hazeHeight[layer.spec.name])
  const groundRow = p.y(layer.ground)
  c.save()
  c.globalCompositeOperation = 'source-atop'
  p.fill(inks.haze, 0, top, p.sheet.width, groundRow + 1)
  const rows = layer.spec.name === 'near' ? 1 : 2
  ;[0.75, 0.5, 0.25].forEach((share, index) => {
    c.fillStyle = pattern(c, inks.haze, share)
    c.fillRect(0, top - (index + 1) * rows, p.sheet.width, rows)
  })
  c.restore()
  p.forget()
  p.fill(inks.haze, 0, groundRow, p.sheet.width, p.sheet.height)
}

/** Made-up glyphs: random 3 x 3 pixel masks with at least three pixels set. */
function glyph(p: Painter, rng: Rng, ink: Ink, x: number, y: number): void {
  for (let cell = 0; cell < 9; cell += 1) if (rng.chance(0.55) || cell === 4) p.fill(ink, x + (cell % 3), y + Math.floor(cell / 3), x + (cell % 3) + 1, y + Math.floor(cell / 3) + 1)
}

/**
 * A video screen: a dark panel with a glowing frame, a big shape (a face, a product) and lines of text,
 * so it reads as an advert rather than a block of colour.
 */
function paintScreen(p: Painter, rng: Rng, x0: number, y0: number, x1: number, y1: number, [bright, dim]: readonly [Ink, Ink]): void {
  const h = y1 - y0
  p.fill(dim, x0, y0, x1, y0 + 1)
  p.fill(dim, x0, y1 - 1, x1, y1)
  p.fill(dim, x0, y0, x0 + 1, y1)
  p.fill(dim, x1 - 1, y0, x1, y1)
  const size = Math.max(2, Math.floor(h * 0.55))
  const left = rng.chance(0.5)
  const sx = left ? x0 + 2 : x1 - 2 - size
  for (let row = 0; row < size; row += 1) {
    const half = Math.round(Math.sqrt(Math.max(0, (size / 2) ** 2 - (row + 0.5 - size / 2) ** 2)))
    p.fill(row < size / 2 ? bright : dim, sx + Math.floor(size / 2) - half, y0 + 2 + row, sx + Math.floor(size / 2) + half, y0 + 3 + row)
  }
  const [tx0, tx1] = left ? [sx + size + 2, x1 - 2] : [x0 + 2, sx - 2]
  for (let line = y0 + 2; line + 1 < y1 - 1 && tx1 - tx0 > 2; line += 3) p.fill(line === y0 + 2 ? bright : dim, tx0, line, tx0 + Math.max(2, Math.floor((tx1 - tx0) * rng.range(0.4, 1))), line + 1)
}

/** One sign: bold flat shapes. Lit neon tubes on a dark board at night; a painted board by day. */
function paintSign(p: Painter, sign: Sign, mood: PixelMood, wall: Ink): void {
  const rng = createRng(sign.seed)
  const [bright, dim] = neonInks(sign.colour)
  const [x0, x1, y0, y1] = [p.x(sign.x0), p.x(sign.x1), p.y(sign.y1), p.y(sign.y0)]
  if (x1 - x0 < 3 || y1 - y0 < 3) return
  const lit = mood.neon
  if (sign.kind === 'logo') {
    // A crown sign along the top of a tower: a band of glyphs rather than a round emblem, which reads as a button.
    paintSign(p, { ...sign, kind: 'board', y0: sign.y1 - 9 * p.sheet.texel }, mood, wall)
    return
  }
  // Unlit by day: a dark board with its lettering in the sign's colour.
  const board = lit ? 0 : step(wall, -2)
  const ink = lit ? bright : dim
  p.fill(board, x0, y0, x1, y1)
  if (sign.kind === 'screen') {
    paintScreen(p, rng, x0, y0, x1, y1, lit ? [bright, dim] : [dim, step(dim, -1)])
    return
  }
  if (lit) {
    // The tube outline.
    p.fill(dim, x0, y0, x1, y0 + 1)
    p.fill(dim, x0, y1 - 1, x1, y1)
    p.fill(dim, x0, y0, x0 + 1, y1)
    p.fill(dim, x1 - 1, y0, x1, y1)
  }
  const vertical = sign.kind === 'vertical'
  const [across, along] = vertical ? [x1 - x0, y1 - y0] : [y1 - y0, x1 - x0]
  if (across < 5) {
    // Too thin for glyphs: a bright tube down the middle, broken into strokes.
    for (let at = 1; at < along - 1; at += 3) {
      if (vertical) p.fill(ink, x0 + Math.floor(across / 2), y0 + at, x0 + Math.floor(across / 2) + 1, y0 + at + 2)
      else p.fill(ink, x0 + at, y0 + Math.floor(across / 2), x0 + at + 2, y0 + Math.floor(across / 2) + 1)
    }
    return
  }
  const offset = Math.floor((across - 3) / 2)
  for (let at = 2; at + 3 <= along - 2; at += 4) {
    if (vertical) glyph(p, rng, ink, x0 + offset, y0 + at)
    else glyph(p, rng, ink, x0 + at, y0 + offset)
  }
}

/**
 * Paints a layer into a fresh canvas of `sheet.width` x `sheet.height` texels; `lit` is the share of lit
 * windows. Every ink painted is added to `used`.
 */
export function paintPixelLayer(layer: Layer, sheet: PixelSheet, mood: PixelMood, lit: number, used: Set<Ink>): HTMLCanvasElement {
  const canvas = makeCanvas(sheet.width, sheet.height)
  const c = context(canvas)
  c.imageSmoothingEnabled = false
  const p = painter(c, sheet, used)
  const inks = mood.layers[layer.spec.name]
  let lastRow = 0
  for (const building of layer.buildings) {
    if (building.row === 1 && lastRow === 0) paintViaduct(p, layer, mood, inks)
    lastRow = building.row
    paintBuilding(p, layer, building, mood, inks, lit)
  }
  paintShopfronts(p, layer, mood)
  paintHaze(p, layer, mood, inks)
  for (const building of layer.buildings) for (const sign of building.signs) paintSign(p, sign, mood, inks.wall)
  return canvas
}
