import { CanvasTexture, SRGBColorSpace } from 'three'
import type { TimeOfDay } from '../../game/site'
import { cellHash } from '../noise'

/**
 * The far backdrop, painted once onto canvases: a sky, and three bands of city at rising distance.
 * Each band is painted in world units (tiles), so a building drawn 40 tiles wide on a band 200 tiles away
 * really is that size, and the perspective camera gives the bands their parallax for free.
 * Ground-level haze thickens with distance, so far shapes are swallowed by mist (the owner's third reference).
 */

/** A rectangle of world space (x across, y up, in tiles) mapped onto a canvas. */
export type Sheet = { left: number; right: number; bottom: number; top: number }

type Painter = { c: CanvasRenderingContext2D; px(x: number): number; py(y: number): number; scaleX: number; scaleY: number; width: number; height: number }

function painter(sheet: Sheet, width: number, height: number): [HTMLCanvasElement, Painter] {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const scaleX = width / (sheet.right - sheet.left)
  const scaleY = height / (sheet.top - sheet.bottom)
  return [canvas, {
    c: canvas.getContext('2d')!, width, height, scaleX, scaleY,
    px: (x) => (x - sheet.left) * scaleX,
    py: (y) => (sheet.top - y) * scaleY,
  }]
}

function finish(canvas: HTMLCanvasElement): CanvasTexture {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

type SkyColours = { stops: [number, string][]; clouds: string; cloudLight: string; stars: boolean; disc: string; halo: string; discSize: number }

const SKY: Record<TimeOfDay, SkyColours> = {
  night: {
    stops: [[0, '#02040a'], [0.45, '#070c1c'], [0.72, '#141a32'], [0.86, '#2a2040'], [0.94, '#3c2c46'], [1, '#2a2236']],
    clouds: 'rgba(40,36,62,', cloudLight: 'rgba(120,80,110,', stars: true, disc: '#e8ecf6', halo: 'rgba(170,190,255,', discSize: 4.5,
  },
  day: {
    stops: [[0, '#4e5b6c'], [0.4, '#6f7c8c'], [0.72, '#98a2ae'], [0.88, '#bdbfbd'], [0.95, '#cfc6b8'], [1, '#b8bcc0']],
    clouds: 'rgba(84,94,110,', cloudLight: 'rgba(214,212,206,', stars: false, disc: '#fff4dc', halo: 'rgba(255,236,200,', discSize: 7,
  },
}

/**
 * The sky itself: a gradient from zenith to the glow above the city, cloud banks, and the moon (or a veiled sun).
 * `ground` is the height of the street in world units; everything is placed relative to it.
 */
export function paintSky(sheet: Sheet, ground: number, time: TimeOfDay): CanvasTexture {
  const [canvas, p] = painter(sheet, 2048, 1024)
  const { c } = p
  const colours = SKY[time]
  const fade = c.createLinearGradient(0, 0, 0, p.height)
  // Gradient stops are laid out against the street level so the glow sits on the city whatever the sheet size.
  const span = sheet.top - sheet.bottom
  const at = (heightAboveGround: number) => Math.min(1, Math.max(0, (sheet.top - (ground + heightAboveGround)) / span))
  const heights = [260, 150, 80, 35, 10, -40]
  colours.stops.forEach(([, colour], index) => fade.addColorStop(at(heights[index]), colour))
  c.fillStyle = fade
  c.fillRect(0, 0, p.width, p.height)

  if (colours.stars) {
    for (let star = 0; star < 700; star += 1) {
      const y = p.py(ground + 70 + cellHash(star, 4, 5) * 300)
      c.fillStyle = `rgba(230,236,255,${0.1 + cellHash(star, 1, 5) * 0.5})`
      const size = cellHash(star, 2, 5) < 0.95 ? 1 : 2
      c.fillRect(cellHash(star, 3, 5) * p.width, y, size, size)
    }
  }

  const disc = { x: p.px((sheet.left + sheet.right) / 2 + 30), y: p.py(ground + (time === 'night' ? 92 : 48)) }
  const glowSize = (time === 'night' ? 26 : 70) * p.scaleX
  const halo = c.createRadialGradient(disc.x, disc.y, 0, disc.x, disc.y, glowSize)
  halo.addColorStop(0, `${colours.halo}0.45)`)
  halo.addColorStop(0.3, `${colours.halo}0.12)`)
  halo.addColorStop(1, `${colours.halo}0)`)
  c.fillStyle = halo
  c.fillRect(disc.x - glowSize, disc.y - glowSize, glowSize * 2, glowSize * 2)
  c.fillStyle = colours.disc
  c.globalAlpha = time === 'night' ? 1 : 0.55
  c.beginPath()
  c.arc(disc.x, disc.y, colours.discSize * p.scaleX * 0.5, 0, Math.PI * 2)
  c.fill()
  c.globalAlpha = 1

  // Long low cloud banks: dark bodies with undersides lit by the city (night) or bright tops (day).
  for (let cloud = 0; cloud < 70; cloud += 1) {
    const x = cellHash(cloud, 1, 9) * p.width
    const y = p.py(ground + 40 + cellHash(cloud, 2, 9) * (time === 'night' ? 150 : 200))
    const w = (40 + cellHash(cloud, 3, 9) * 140) * p.scaleX
    const h = (3 + cellHash(cloud, 4, 9) * 8) * p.scaleY
    const body = c.createRadialGradient(x, y, 0, x, y, w / 2)
    body.addColorStop(0, `${colours.clouds}${0.35 + cellHash(cloud, 5, 9) * 0.3})`)
    body.addColorStop(1, `${colours.clouds}0)`)
    c.save()
    c.translate(x, y)
    c.scale(1, h / w)
    c.translate(-x, -y)
    c.fillStyle = body
    c.fillRect(x - w / 2, y - w / 2, w, w)
    const lit = c.createRadialGradient(x, y + (time === 'night' ? w * 0.12 : -w * 0.12), 0, x, y, w / 2.4)
    lit.addColorStop(0, `${colours.cloudLight}${0.12 + cellHash(cloud, 6, 9) * 0.12})`)
    lit.addColorStop(1, `${colours.cloudLight}0)`)
    c.fillStyle = lit
    c.fillRect(x - w / 2, y - w / 2, w, w)
    c.restore()
  }
  return finish(canvas)
}

/** How one band of distant city looks. Heights and widths are in tiles; haze is how much mist covers it. */
export type CityBand = {
  seed: number
  body: string
  /** Colour of the mist rising from the street, and how high (in tiles) it climbs up this band. */
  haze: string
  hazeHeight: number
  /** Extra veil over the whole band, 0..1: the further away, the more it fades into the air. */
  veil: number
  minHeight: number
  maxHeight: number
  minWidth: number
  maxWidth: number
  /** Window grid pitch in tiles, the share of windows lit, and their colours. */
  pitch: number
  lit: number
  windowColours: readonly string[]
  neon: number
  beacons: boolean
  giants: number
}

export const NIGHT_BANDS: readonly CityBand[] = [
  { seed: 31, body: '#181c30', haze: '#2a2340', hazeHeight: 90, veil: 0.62, minHeight: 30, maxHeight: 120, minWidth: 14, maxWidth: 34, pitch: 2.4, lit: 0.18, windowColours: ['#c89060', '#9aa8d0'], neon: 0, beacons: true, giants: 2 },
  { seed: 17, body: '#131828', haze: '#261e3a', hazeHeight: 55, veil: 0.25, minHeight: 20, maxHeight: 85, minWidth: 10, maxWidth: 26, pitch: 1.8, lit: 0.22, windowColours: ['#ffb060', '#ffc888', '#a8c8ff'], neon: 10, beacons: true, giants: 0 },
  { seed: 5, body: '#0b0e1a', haze: '#20182e', hazeHeight: 30, veil: 0.08, minHeight: 14, maxHeight: 60, minWidth: 8, maxWidth: 20, pitch: 1.5, lit: 0.28, windowColours: ['#ffb347', '#ffd090', '#9fd0ff', '#ff9a5a'], neon: 16, beacons: true, giants: 0 },
]

export const DAY_BANDS: readonly CityBand[] = [
  { seed: 31, body: '#9aa2ac', haze: '#bcc2c8', hazeHeight: 110, veil: 0.55, minHeight: 30, maxHeight: 120, minWidth: 14, maxWidth: 34, pitch: 2.4, lit: 0.5, windowColours: ['#8a929c'], neon: 0, beacons: false, giants: 2 },
  { seed: 17, body: '#7e8792', haze: '#b2b9c0', hazeHeight: 70, veil: 0.3, minHeight: 20, maxHeight: 85, minWidth: 10, maxWidth: 26, pitch: 1.8, lit: 0.6, windowColours: ['#5e6670', '#6a737e'], neon: 6, beacons: false, giants: 0 },
  { seed: 5, body: '#5e6670', haze: '#a8b0b8', hazeHeight: 40, veil: 0.1, minHeight: 14, maxHeight: 60, minWidth: 8, maxWidth: 20, pitch: 1.5, lit: 0.65, windowColours: ['#3a424c', '#454e5a', '#7a8794'], neon: 10, beacons: false, giants: 0 },
]

const NEON = ['#ff2d95', '#19e3ff', '#ffb000', '#8a5cff', '#7cff4f']
const DULL_SIGNS = ['#a0483a', '#3a6a8a', '#b89a3a', '#5a4a7a']

/** One band of city: building silhouettes with windows, signs and beacons, then mist rising from the street. */
export function paintCity(sheet: Sheet, ground: number, band: CityBand, time: TimeOfDay): CanvasTexture {
  const [canvas, p] = painter(sheet, 2048, 1024)
  const { c } = p
  const night = time === 'night'
  let x = sheet.left
  for (let index = 0; x < sheet.right; index += 1) {
    const width = band.minWidth + cellHash(index, band.seed, 1) * (band.maxWidth - band.minWidth)
    const tall = cellHash(index, band.seed, 2)
    const height = band.minHeight + tall * tall * (band.maxHeight - band.minHeight)
    tower(p, band, x, width, ground, height, index, night)
    x += width + cellHash(index, band.seed, 3) * 4
  }
  for (let giant = 0; giant < band.giants; giant += 1) {
    megastructure(p, band, sheet.left + (sheet.right - sheet.left) * (0.22 + giant * 0.5), ground, giant, night)
  }
  if (band.veil > 0) {
    c.globalAlpha = band.veil
    c.fillStyle = band.haze
    c.globalCompositeOperation = 'source-atop'
    c.fillRect(0, 0, p.width, p.height)
    c.globalCompositeOperation = 'source-over'
    c.globalAlpha = 1
  }
  const mist = c.createLinearGradient(0, p.py(ground + band.hazeHeight), 0, p.py(ground - 4))
  mist.addColorStop(0, `${band.haze}00`)
  mist.addColorStop(0.65, `${band.haze}b0`)
  mist.addColorStop(1, `${band.haze}ff`)
  c.fillStyle = mist
  c.fillRect(0, p.py(ground + band.hazeHeight), p.width, p.height)
  c.fillStyle = band.haze
  c.fillRect(0, p.py(ground - 4), p.width, p.height)
  if (night) streetGlow(p, band, ground)
  return finish(canvas)
}

function tower(p: Painter, band: CityBand, x: number, width: number, ground: number, height: number, index: number, night: boolean): void {
  const { c } = p
  const [x0, x1, top] = [p.px(x), p.px(x + width), p.py(ground + height)]
  c.fillStyle = band.body
  c.fillRect(x0, top, x1 - x0, p.height - top)
  // A setback crown on some towers, and a mast on a few.
  if (cellHash(index, band.seed, 4) < 0.35) c.fillRect(p.px(x + width * 0.25), p.py(ground + height + 6), (x1 - x0) * 0.5, p.py(ground + height) - p.py(ground + height + 6))
  const mast = cellHash(index, band.seed, 5) < 0.3
  if (mast) c.fillRect(p.px(x + width / 2) - 1, p.py(ground + height + 16), 2, p.py(ground + height) - p.py(ground + height + 16))
  windowsOn(p, band, x, width, ground, height, index)
  if (band.neon > 0 && cellHash(index, band.seed, 6) < band.neon / 40) sign(p, band, x, width, ground, height, index, night)
  if (band.beacons && night && (mast || cellHash(index, band.seed, 7) < 0.25)) beacon(p, p.px(x + width / 2), p.py(ground + height + (mast ? 16 : 0)))
}

function windowsOn(p: Painter, band: CityBand, x: number, width: number, ground: number, height: number, index: number): void {
  const { c } = p
  const w = Math.max(1, band.pitch * 0.5 * p.scaleX)
  const h = Math.max(1, band.pitch * 0.45 * p.scaleY)
  // Whole floors tend to be lit or dark together, as offices and flats are.
  for (let y = ground + 2; y < ground + height - 1.5; y += band.pitch) {
    const floorLit = cellHash(Math.round(y * 10), index, band.seed + 11) < 0.55
    for (let wx = x + band.pitch * 0.4; wx < x + width - band.pitch * 0.5; wx += band.pitch) {
      const roll = cellHash(Math.round(wx * 10), Math.round(y * 10), band.seed)
      if (roll > band.lit * (floorLit ? 1.8 : 0.5)) continue
      c.globalAlpha = 0.55 + roll * 0.45 / Math.max(0.01, band.lit)
      c.fillStyle = band.windowColours[Math.floor(roll * 1000) % band.windowColours.length]
      c.fillRect(p.px(wx), p.py(y + band.pitch * 0.45), w, h)
    }
  }
  c.globalAlpha = 1
}

/** A vertical or horizontal sign: glowing tubes at night, painted panels by day. */
function sign(p: Painter, band: CityBand, x: number, width: number, ground: number, height: number, index: number, night: boolean): void {
  const { c } = p
  const colour = (night ? NEON : DULL_SIGNS)[Math.floor(cellHash(index, band.seed, 8) * 97) % (night ? NEON.length : DULL_SIGNS.length)]
  const vertical = cellHash(index, band.seed, 9) < 0.55
  const [w, h] = vertical ? [Math.max(2, width * 0.12), Math.min(height * 0.5, 18)] : [width * 0.7, Math.max(2, height * 0.06)]
  const sx = vertical ? x + width - w * 0.6 : x + width * 0.15
  const sy = ground + height * (vertical ? 0.4 : 0.85)
  const [x0, y0, pw, ph] = [p.px(sx), p.py(sy + h), w * p.scaleX, h * p.scaleY]
  if (night) {
    const glowSize = Math.max(pw, ph) * 1.2
    const glow = c.createRadialGradient(x0 + pw / 2, y0 + ph / 2, 0, x0 + pw / 2, y0 + ph / 2, glowSize)
    glow.addColorStop(0, `${colour}55`)
    glow.addColorStop(1, `${colour}00`)
    c.fillStyle = glow
    c.fillRect(x0 + pw / 2 - glowSize, y0 + ph / 2 - glowSize, glowSize * 2, glowSize * 2)
  }
  c.fillStyle = night ? '#0a0a10' : '#2a2e34'
  c.fillRect(x0, y0, pw, ph)
  c.strokeStyle = colour
  c.fillStyle = colour
  c.lineWidth = Math.max(1, Math.min(pw, ph) * 0.12)
  c.strokeRect(x0 + c.lineWidth, y0 + c.lineWidth, pw - c.lineWidth * 2, ph - c.lineWidth * 2)
  // Suggested lettering: short bars, unreadable at this distance, which is the point.
  const marks = vertical ? Math.floor(ph / (pw * 0.9)) : Math.floor(pw / (ph * 0.8))
  for (let mark = 0; mark < marks; mark += 1) {
    if (vertical) c.fillRect(x0 + pw * 0.3, y0 + ph * 0.08 + mark * pw * 0.9, pw * 0.4, pw * 0.55)
    else c.fillRect(x0 + pw * 0.06 + mark * ph * 0.8, y0 + ph * 0.3, ph * 0.5, ph * 0.4)
  }
}

function beacon(p: Painter, x: number, y: number): void {
  const { c } = p
  const glow = c.createRadialGradient(x, y, 0, x, y, 4)
  glow.addColorStop(0, 'rgba(255,70,50,0.95)')
  glow.addColorStop(1, 'rgba(255,60,40,0)')
  c.fillStyle = glow
  c.fillRect(x - 4, y - 4, 8, 8)
}

/** A colossal arcology rising out of the haze: stepped tiers, light strips, a spire and warning lights. */
function megastructure(p: Painter, band: CityBand, centre: number, ground: number, index: number, night: boolean): void {
  const { c } = p
  const tiers = [[90, 120], [66, 200], [44, 260], [20, 300]] as const
  const scale = index === 0 ? 1 : 0.8
  c.fillStyle = band.body
  for (const [width, top] of tiers) {
    const w = width * scale
    c.fillRect(p.px(centre - w / 2), p.py(ground + top * scale), w * p.scaleX, p.height)
  }
  const spireTop = ground + 340 * scale
  c.fillRect(p.px(centre) - 2, p.py(spireTop), 4, p.py(ground + 300 * scale) - p.py(spireTop))
  for (const [width, top] of tiers) {
    const w = width * scale
    c.fillStyle = night ? 'rgba(150,190,255,0.16)' : 'rgba(60,70,84,0.2)'
    for (let strip = -w / 2 + 4; strip < w / 2 - 3; strip += 9) c.fillRect(p.px(centre + strip), p.py(ground + top * scale - 2), 2, p.py(ground) - p.py(ground + top * scale - 2))
    if (night) {
      beacon(p, p.px(centre - w / 2 + 1), p.py(ground + top * scale))
      beacon(p, p.px(centre + w / 2 - 1), p.py(ground + top * scale))
    }
  }
  if (night) {
    beacon(p, p.px(centre), p.py(spireTop))
    // A searchlight sweeping up from the crown.
    const [bx, by] = [p.px(centre + 8), p.py(ground + 300 * scale)]
    const beam = c.createLinearGradient(bx, by, bx + 160, by - 600)
    beam.addColorStop(0, 'rgba(180,200,255,0.16)')
    beam.addColorStop(1, 'rgba(180,200,255,0)')
    c.fillStyle = beam
    c.beginPath()
    c.moveTo(bx, by)
    c.lineTo(bx + 120 + index * 80, 0)
    c.lineTo(bx + 220 + index * 80, 0)
    c.closePath()
    c.fill()
  }
}

/** Street lights and traffic glowing through the mist at the foot of a night band. */
function streetGlow(p: Painter, band: CityBand, ground: number): void {
  const { c } = p
  for (let light = 0; light < 220; light += 1) {
    const x = cellHash(light, band.seed, 21) * p.width
    const y = p.py(ground + cellHash(light, band.seed, 22) * band.hazeHeight * 0.4)
    const size = 2 + cellHash(light, band.seed, 23) * 5
    const glow = c.createRadialGradient(x, y, 0, x, y, size)
    glow.addColorStop(0, cellHash(light, band.seed, 24) < 0.7 ? 'rgba(255,170,90,0.6)' : 'rgba(150,200,255,0.5)')
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    c.fillStyle = glow
    c.fillRect(x - size, y - size, size * 2, size * 2)
  }
}
