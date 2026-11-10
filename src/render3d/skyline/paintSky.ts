import { tileNoise } from '../noise'
import { mapping, REGIONS, type Mapping } from './atlas'
import { context, drawSoft, makeCanvas } from './canvas'
import { css, mix } from './colour'
import type { Sheet } from './frame'
import type { Mood } from './moods'
import { createRng, type Rng } from './random'

/** The sky, mist and rain pictures of the atlas. Painted once at load. */

function gradient(c: CanvasRenderingContext2D, map: Mapping, ground: number, mood: Mood): void {
  const fill = c.createLinearGradient(0, 0, 0, map.height)
  for (const [height, colour] of mood.sky) fill.addColorStop(Math.min(1, Math.max(0, map.y(ground + height) / map.height)), colour)
  c.fillStyle = fill
  c.fillRect(0, 0, map.width, map.height)
}

function stars(c: CanvasRenderingContext2D, map: Mapping, ground: number, mood: Mood, rng: Rng): void {
  for (let star = 0; star < 500 * mood.stars; star += 1) {
    const y = map.y(ground + rng.range(170, 420))
    c.fillStyle = css('#dfe6ff', rng.range(0.15, 0.6) * Math.min(1, (map.height * 0.6 - y) / (map.height * 0.3)))
    c.fillRect(rng.range(0, map.width), y, 1, 1)
  }
}

function disc(c: CanvasRenderingContext2D, map: Mapping, sheet: Sheet, ground: number, mood: Mood): void {
  if (!mood.disc) return
  const { height, across, colour, halo, size, glow } = mood.disc
  const [x, y] = [map.x(sheet.left + (sheet.right - sheet.left) * across), map.y(ground + height)]
  const reach = size * map.scaleX * 14
  const light = c.createRadialGradient(x, y, 0, x, y, reach)
  light.addColorStop(0, css(halo, 0.5 * glow))
  light.addColorStop(0.15, css(halo, 0.2 * glow))
  light.addColorStop(1, css(halo, 0))
  c.fillStyle = light
  c.fillRect(x - reach, y - reach, reach * 2, reach * 2)
  c.fillStyle = css(colour, mood.name === 'overcast' ? 0.12 : 0.95)
  c.beginPath()
  c.ellipse(x, y, size * map.scaleX, size * map.scaleY, 0, 0, Math.PI * 2)
  c.fill()
}

/** A cloud: overlapping puffs, darker on top and lit from below by the city or the low sun. */
function cloud(c: CanvasRenderingContext2D, rng: Rng, x: number, y: number, width: number, height: number, mood: Mood, alpha: number): void {
  const puffs = 5 + Math.floor(rng.range(0, 6))
  c.fillStyle = css(mood.cloud, alpha)
  c.beginPath()
  for (let puff = 0; puff < puffs; puff += 1) {
    const px = x + rng.range(-0.5, 0.5) * width
    const py = y + rng.range(-0.25, 0.25) * height
    c.moveTo(px, py)
    c.ellipse(px, py, width * rng.range(0.15, 0.32), height * rng.range(0.3, 0.55), 0, 0, Math.PI * 2)
  }
  c.fill()
  c.save()
  c.globalCompositeOperation = 'source-atop'
  const under = c.createLinearGradient(0, y - height * 0.5, 0, y + height * 0.6)
  under.addColorStop(0, css(mood.cloudLight, 0))
  under.addColorStop(1, css(mood.cloudLight, 0.55))
  c.fillStyle = under
  c.fillRect(x - width, y - height, width * 2, height * 2)
  c.restore()
}

function clouds(atlas: CanvasRenderingContext2D, map: Mapping, ground: number, mood: Mood, rng: Rng): void {
  const layer = makeCanvas(map.width, map.height)
  const c = context(layer)
  const thick = mood.name === 'overcast' || mood.name === 'wet' ? 1.6 : 1
  // High streaks, then low banks the tallest towers rise into.
  for (let streak = 0; streak < 26 * thick; streak += 1) {
    c.fillStyle = css(mix(mood.cloud, mood.cloudLight, 0.3), rng.range(0.08, 0.2))
    c.beginPath()
    c.ellipse(rng.range(0, map.width), map.y(ground + rng.range(190, 330)), rng.range(40, 160), rng.range(2, 6), 0, 0, Math.PI * 2)
    c.fill()
  }
  for (let bank = 0; bank < 30 * thick; bank += 1) {
    const width = rng.range(60, 200) * (map.width / 1020)
    cloud(c, rng, rng.range(-20, map.width + 20), map.y(ground + rng.range(80, 190)), width, width * rng.range(0.16, 0.3), mood, rng.range(0.45, 0.85))
  }
  drawSoft(atlas, layer, REGIONS.sky.x, REGIONS.sky.y, 3)
}

export function paintSky(atlas: CanvasRenderingContext2D, sheet: Sheet, ground: number, mood: Mood, seed: number): void {
  const region = REGIONS.sky
  const map = mapping(sheet, region)
  const canvas = makeCanvas(region.w, region.h)
  const c = context(canvas)
  const rng = createRng(seed * 31 + 7)
  gradient(c, map, ground, mood)
  stars(c, map, ground, mood, rng)
  disc(c, map, sheet, ground, mood)
  atlas.drawImage(canvas, region.x, region.y)
  clouds(atlas, map, ground, mood, rng)
}

/** Drifting mist: soft noise that tiles in both directions, white with the density in alpha. */
export function paintMist(atlas: CanvasRenderingContext2D): void {
  const { x, y, w, h } = REGIONS.mist
  const image = atlas.createImageData(w, h)
  for (let row = 0; row < h; row += 1) {
    for (let column = 0; column < w; column += 1) {
      const n = 0.6 * tileNoise(column / w, row / h, 4, 11) + 0.4 * tileNoise(column / w, row / h, 8, 12)
      const at = (row * w + column) * 4
      image.data.set([255, 255, 255, Math.round(255 * Math.min(1, Math.max(0, (n - 0.3) * 2)))], at)
    }
  }
  atlas.putImageData(image, x, y)
}

/** Rain: thin falling streaks, tiling vertically and across. */
export function paintRain(atlas: CanvasRenderingContext2D, seed: number): void {
  const { x, y, w, h } = REGIONS.rain
  const rng = createRng(seed + 99)
  atlas.save()
  atlas.beginPath()
  atlas.rect(x, y, w, h)
  atlas.clip()
  for (let streak = 0; streak < 60; streak += 1) {
    const [sx, sy, length] = [x + rng.range(0, w), y + rng.range(0, h), rng.range(8, 26)]
    atlas.fillStyle = css('#ffffff', rng.range(0.25, 0.7))
    for (const shift of [-h, 0]) atlas.fillRect(sx, sy + shift, 1, length)
  }
  atlas.restore()
}
