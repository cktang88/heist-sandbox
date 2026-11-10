import { mapping, REGIONS, type Mapping } from './atlas'
import { context, drawSoft, makeCanvas } from './canvas'
import { css, mix, scale, type Rgb } from './colour'
import { blurRadius } from './frame'
import { forEachWindow, windowIsWarm, windowLight, type Building, type Layer, type Roof } from './layout'
import type { Mood } from './moods'
import { paintGlows, paintSigns } from './paintSigns'
import { createRng } from './random'

/**
 * Paints one layer of city into its atlas region: silhouettes with setbacks and roof clutter, windows,
 * the viaduct, ground mist, signs and a wet street mirroring them, then blurs it all by the lens blur
 * at that depth. Done once at load.
 */

/** Extra haze per row: the back row of a layer sits a little deeper in the air than the front. */
const ROW_HAZE = [0.14, 0.05, 0]
/** How high the ground mist climbs, per layer (tiles). */
const MIST_HEIGHT = { far: 110, mid: 55, near: 20 } as const
/** Window brightness per layer: the far ones must survive the strongest blur, the near ones must not shout. */
const WINDOW_GAIN = { far: 0.85, mid: 0.6, near: 0.48 } as const

function wallOf(layer: Layer, building: Building, mood: Mood): Rgb {
  const haze = Math.min(0.9, (layer.spec.haze * 0.45 + ROW_HAZE[building.row]) * mood.air)
  return scale(mix(mood.building, mood.haze, haze), 1 + 0.12 * building.shade)
}

function fillWorld(c: CanvasRenderingContext2D, map: Mapping, x0: number, y0: number, x1: number, y1: number): void {
  c.fillRect(map.x(x0), map.y(y1), Math.max(1, (x1 - x0) * map.scaleX), Math.max(1, (y1 - y0) * map.scaleY))
}

function paintRoof(c: CanvasRenderingContext2D, map: Mapping, roof: Roof): void {
  const thin = 1 / map.scaleX
  const top = roof.base + roof.height
  switch (roof.kind) {
    case 'antenna':
      fillWorld(c, map, roof.x, roof.base, roof.x + Math.max(roof.width, thin), top)
      fillWorld(c, map, roof.x - 0.8, roof.base + roof.height * 0.6, roof.x + 1.2, roof.base + roof.height * 0.6 + thin)
      break
    case 'spire': {
      const middle = roof.x + roof.width / 2
      c.beginPath()
      c.moveTo(map.x(middle - 2.4), map.y(roof.base))
      c.lineTo(map.x(middle), map.y(top))
      c.lineTo(map.x(middle + 2.4), map.y(roof.base))
      c.fill()
      break
    }
    case 'tank':
      fillWorld(c, map, roof.x, roof.base + 1.2, roof.x + roof.width, top)
      fillWorld(c, map, roof.x + 0.2, roof.base, roof.x + 0.2 + thin, roof.base + 1.2)
      fillWorld(c, map, roof.x + roof.width - 0.2 - thin, roof.base, roof.x + roof.width - 0.2, roof.base + 1.2)
      c.beginPath()
      c.moveTo(map.x(roof.x), map.y(top))
      c.lineTo(map.x(roof.x + roof.width / 2), map.y(top + 1))
      c.lineTo(map.x(roof.x + roof.width), map.y(top))
      c.fill()
      break
    case 'crane': {
      // Mast, jib along the top, counter-jib with its weight, and the hook line.
      const jibEnd = roof.x + roof.width
      fillWorld(c, map, roof.x, roof.base, roof.x + 0.9, top + 2)
      fillWorld(c, map, Math.min(roof.x, jibEnd), top, Math.max(roof.x, jibEnd), top + 0.7)
      const back = roof.x - roof.width * 0.3
      fillWorld(c, map, Math.min(roof.x, back), top, Math.max(roof.x, back), top + 0.7)
      fillWorld(c, map, Math.min(back, back + Math.sign(roof.width) * 2), top - 1.6, Math.max(back, back + Math.sign(roof.width) * 2), top)
      const hook = roof.x + roof.width * 0.7
      fillWorld(c, map, hook, top - roof.height * 0.5, hook + thin, top)
      break
    }
    case 'billboard':
      fillWorld(c, map, roof.x + 1, roof.base - 2.5, roof.x + 1 + 0.5, roof.base)
      fillWorld(c, map, roof.x + roof.width - 1.5, roof.base - 2.5, roof.x + roof.width - 1, roof.base)
      break
    case 'chimney':
      fillWorld(c, map, roof.x, roof.base, roof.x + roof.width, top)
      break
    case 'dish':
      c.beginPath()
      c.ellipse(map.x(roof.x + 1), map.y(roof.base + 1.2), roof.width * 0.5 * map.scaleX, roof.width * 0.3 * map.scaleY, -0.5, 0, Math.PI * 2)
      c.fill()
      break
  }
}

/** Lit windows, unlit glass where daylight shows it, and air-conditioning boxes on the near blocks. */
function paintWindows(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, building: Building, mood: Mood, wall: Rgb): void {
  const clear = WINDOW_GAIN[layer.spec.name]
  const glass = mood.lit < 0.2 ? css(mix(mood.glass, wall, 0.15 + layer.spec.haze * 0.3), 0.85) : null
  const styles = new Map<string, string>()
  const style = (colour: string, level: number): string => {
    const key = `${colour}${level}`
    let value = styles.get(key)
    if (!value) styles.set(key, (value = css(colour, (0.35 + 0.65 * (level / 4)) * clear)))
    return value
  }
  if (building.facade === 'curtain' && glass) {
    // A glass tower by day: the whole face reflects the sky, darker toward the top.
    for (const tier of building.tiers) {
      const sheen = c.createLinearGradient(0, map.y(tier.top), 0, map.y(layer.ground))
      sheen.addColorStop(0, css(mix(mood.glass, wall, 0.2), 0.9))
      sheen.addColorStop(1, css(mix(mood.haze, wall, 0.4), 0.9))
      c.fillStyle = sheen
      fillWorld(c, map, tier.x0 + 0.4, layer.ground + 2, tier.x1 - 0.4, tier.top - 0.6)
    }
  }
  const ac = layer.spec.name === 'near' ? css(scale(wall, 1.35)) : null
  forEachWindow(building, layer.ground, (cell) => {
    const lit = windowLight(building, cell, mood.lit)
    if (lit > 0) {
      const palette = windowIsWarm(building, cell) ? mood.warm : mood.cold
      c.fillStyle = style(palette[(cell.floor + cell.column) % palette.length], Math.round(lit * 4))
    } else if (glass && building.facade !== 'curtain') c.fillStyle = glass
    else return
    fillWorld(c, map, cell.x, cell.y, cell.x + cell.w, cell.y + cell.h)
    if (ac && (cell.floor * 7 + cell.column * 3) % 11 === 0) {
      c.fillStyle = ac
      fillWorld(c, map, cell.x + cell.w * 0.1, cell.y - 0.75, cell.x + cell.w * 0.8, cell.y - 0.15)
    }
  })
}

/** Shopfronts glowing along the street: the warm band at the foot of every block at night. */
function paintShopfronts(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, mood: Mood): void {
  if (mood.lit < 0.1 || layer.spec.name === 'far') return
  const rng = createRng(layer.buildings.length * 17 + 3)
  for (const building of layer.buildings) {
    if (building.row !== layer.buildings[layer.buildings.length - 1].row) continue
    for (let x = building.x0 + 0.6; x < building.x1 - 3; x += rng.range(3, 7)) {
      if (!rng.chance(0.55)) continue
      c.fillStyle = css(rng.pick(mood.warm), rng.range(0.35, 0.7))
      fillWorld(c, map, x, layer.ground + 0.3, x + rng.range(2, 4.5), layer.ground + 2.4)
    }
  }
}

/** The elevated railway: a deck on pillars across the whole layer. */
function paintViaduct(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, mood: Mood): void {
  if (layer.rail === null) return
  const deck = mix(mood.building, mood.haze, layer.spec.haze * 0.45)
  c.fillStyle = css(deck)
  fillWorld(c, map, layer.sheet.left, layer.rail - 1.4, layer.sheet.right, layer.rail)
  fillWorld(c, map, layer.sheet.left, layer.rail + 2.6, layer.sheet.right, layer.rail + 2.9)
  for (let x = layer.sheet.left + 6; x < layer.sheet.right; x += 16) fillWorld(c, map, x, layer.ground, x + 1.8, layer.rail - 1.4)
  if (mood.lit > 0.1) {
    c.fillStyle = css('#ffb060', 0.8)
    for (let x = layer.sheet.left + 3; x < layer.sheet.right; x += 8) fillWorld(c, map, x, layer.rail - 1.6, x + 0.4, layer.rail - 1.2)
  }
}

/** Haze over everything painted so far: a general veil by distance, thicker toward the street. */
function paintHaze(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, mood: Mood): void {
  c.save()
  c.globalCompositeOperation = 'source-atop'
  c.fillStyle = css(mood.haze, layer.spec.haze * 0.25 * mood.air)
  c.fillRect(0, 0, map.width, map.height)
  const fog = c.createLinearGradient(0, map.y(layer.ground), 0, map.y(layer.ground + MIST_HEIGHT[layer.spec.name]))
  fog.addColorStop(0, css(mood.haze, Math.min(0.95, mood.mist * (0.55 + layer.spec.haze))))
  fog.addColorStop(1, css(mood.haze, 0))
  c.fillStyle = fog
  c.fillRect(0, 0, map.width, map.y(layer.ground))
  c.restore()
}

/** Steam rising from chimneys, lit by the city. */
function paintSteam(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, mood: Mood): void {
  const colour = mix(mood.haze, mood.cloudLight, 0.35)
  for (const building of layer.buildings) {
    for (const roof of building.roofs) {
      if (roof.kind !== 'chimney') continue
      for (let puff = 0; puff < 7; puff += 1) {
        const [x, y] = [map.x(roof.x + roof.width / 2 + puff * 1.4), map.y(roof.base + roof.height + 1 + puff * 2.2)]
        const radius = (1.4 + puff * 0.9) * map.scaleX
        const cloud = c.createRadialGradient(x, y, 0, x, y, radius)
        cloud.addColorStop(0, css(colour, 0.32 - puff * 0.035))
        cloud.addColorStop(1, css(colour, 0))
        c.fillStyle = cloud
        c.fillRect(x - radius, y - radius, radius * 2, radius * 2)
      }
    }
  }
}

/** Below the street line: wet ground mirroring the lights above it, sinking into mist. */
function paintStreet(c: CanvasRenderingContext2D, map: Mapping, layer: Layer, mood: Mood, street: Rgb): void {
  const line = Math.round(map.y(layer.ground))
  const depth = map.height - line
  const wet = mood.name === 'wet' ? 0.6 : mood.lit > 0.2 ? 0.42 : 0.2
  c.fillStyle = css(street)
  c.fillRect(0, line, map.width, depth)
  c.save()
  c.globalAlpha = wet
  c.translate(0, line * 2)
  c.scale(1, -1)
  const reach = Math.min(line, depth * 1.6)
  c.drawImage(c.canvas, 0, line - reach, map.width, reach, 0, line - reach * 0.6, map.width, reach * 0.6)
  c.restore()
  const fade = c.createLinearGradient(0, line, 0, map.height)
  fade.addColorStop(0, css(street, 0.1))
  fade.addColorStop(0.75, css(street, 1))
  c.fillStyle = fade
  c.fillRect(0, line, map.width, depth)
}

export function paintLayer(atlas: CanvasRenderingContext2D, layer: Layer, mood: Mood): void {
  const region = REGIONS[layer.spec.name]
  const map = mapping(layer.sheet, region)
  const scratch = makeCanvas(region.w, region.h)
  const c = context(scratch)
  let lastWall: Rgb = mix(mood.building, mood.haze, layer.spec.haze)
  let lastRow = 0
  for (const building of layer.buildings) {
    // The viaduct runs in front of the back row of towers and behind the lower blocks.
    if (building.row === 1 && lastRow === 0) paintViaduct(c, map, layer, mood)
    lastRow = building.row
    const wall = wallOf(layer, building, mood)
    lastWall = wall
    c.fillStyle = css(wall)
    for (const tier of building.tiers) fillWorld(c, map, tier.x0, layer.ground - 1, tier.x1, tier.top)
    for (const roof of building.roofs) paintRoof(c, map, roof)
    // The edge facing the city glow catches a little light.
    c.fillStyle = css(mood.rim, 0.22 * (1 - layer.spec.haze))
    for (const tier of building.tiers) fillWorld(c, map, tier.x0, layer.ground, tier.x0 + Math.max(0.5, 1.2 / map.scaleX), tier.top)
    // Tops pick up the sky; the lower floors sink into the street's shadow.
    for (const tier of building.tiers) {
      const sheen = c.createLinearGradient(0, map.y(tier.top), 0, map.y(layer.ground + (tier.top - layer.ground) * 0.4))
      sheen.addColorStop(0, css(mood.rim, 0.12))
      sheen.addColorStop(1, css(mood.rim, 0))
      c.fillStyle = sheen
      fillWorld(c, map, tier.x0, layer.ground + (tier.top - layer.ground) * 0.4, tier.x1, tier.top)
    }
    paintWindows(c, map, layer, building, mood, wall)
  }
  paintShopfronts(c, map, layer, mood)
  paintHaze(c, map, layer, mood)
  paintSteam(c, map, layer, mood)
  paintSigns(c, map, layer, mood, css(lastWall))
  const street = scale(mix(mood.building, mood.haze, Math.min(1, layer.spec.haze + mood.mist * 0.5)), 0.9)
  paintStreet(c, map, layer, mood, street)

  // Lens blur in atlas pixels: sigma about half the blur disc's radius.
  drawSoft(atlas, scratch, region.x, region.y, blurRadius(layer.spec.z) * map.scaleX * 0.5)
  atlas.save()
  atlas.beginPath()
  atlas.rect(region.x, region.y, region.w, region.h)
  atlas.clip()
  paintGlows(atlas, map, layer, mood, region.x, region.y)
  atlas.restore()
  // The bottom rows are stretched below the street (see cards.ts), so they must be solid street colour.
  atlas.fillStyle = css(street)
  atlas.fillRect(region.x, region.y + region.h - 4, region.w, 4)
}
