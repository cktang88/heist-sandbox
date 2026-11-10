import { blurRadius, SKY_Z, spanAt } from './frame'
import { buildingTop, forEachWindow, windowIsWarm, windowLight, type Layer } from './layout'
import { NEON, type Mood } from './moods'
import { createRng, hash3 } from './random'

/**
 * The out-of-focus point lights of the city: each is drawn as a soft disc the size of the lens blur at its
 * depth (a "bokeh" disc), so a far window is not a dot but a pale coin of light. Pure data.
 */
export type LightKind = 'steady' | 'twinkle' | 'blink' | 'flicker' | 'moving' | 'flying'
export const LIGHT_KINDS: readonly LightKind[] = ['steady', 'twinkle', 'blink', 'flicker', 'moving', 'flying']

export type Light = {
  x: number
  y: number
  z: number
  /** Disc radius in world units. */
  radius: number
  colour: string
  /** Peak brightness of the disc's centre, before the mood's scale (0..1). */
  strength: number
  kind: LightKind
  /** Hexagonal aperture instead of round, for a few of the brightest. */
  hex: boolean
  phase: number
  /** Tiles per second for moving lights; cycles per second otherwise. */
  speed: number
}

/** Per layer, the most discs it may have: they are cheap, but a busy backdrop fights the game. */
export const LIGHT_BUDGET = { far: 520, mid: 460, near: 300, sky: 6 } as const

const AVIATION = '#ff2a1a'
const SODIUM = '#ff9f45'
/** Share of lit windows that also get a disc, per layer: nearer ones are bigger, so fewer. */
const WINDOW_DISCS = { far: 0.034, mid: 0.03, near: 0.04 } as const

/** Aviation beacons, picked windows, points along neon signs, street lamps, cars and the elevated train. */
export function layerLights(layer: Layer, mood: Mood, seed: number): Light[] {
  const { spec, ground } = layer
  const name = spec.name
  const z = spec.z
  const base = blurRadius(z)
  const rng = createRng(seed * 104729 + z)
  const lights: Light[] = []
  const add = (x: number, y: number, colour: string, strength: number, kind: LightKind, extra: Partial<Light> = {}) => {
    lights.push({ x, y, z, radius: base * rng.range(0.75, 1.2), colour, strength, kind, hex: false, phase: rng.range(0, 100), speed: rng.range(0.3, 1.2), ...extra })
  }
  for (const building of layer.buildings) {
    for (const roof of building.roofs) {
      if (roof.kind === 'antenna' || roof.kind === 'spire') add(roof.x + roof.width / 2, roof.base + roof.height, AVIATION, 0.6, 'blink', { radius: base * 0.7 })
      if (roof.kind === 'crane') add(roof.x + roof.width, roof.base + roof.height, AVIATION, 0.8, 'blink', { radius: base * 0.8 })
    }
    const top = buildingTop(building)
    if (top - ground > 140 && building.roofs.length === 0) {
      const tier = building.tiers[building.tiers.length - 1]
      add(tier.x0 + 0.5, tier.top, AVIATION, 0.7, 'blink', { radius: base * 0.7 })
      add(tier.x1 - 0.5, tier.top, AVIATION, 0.7, 'blink', { radius: base * 0.7 })
    }
    if (mood.bokeh > 0.2) {
      forEachWindow(building, ground, (cell) => {
        const lit = windowLight(building, cell, mood.lit)
        if (lit === 0 || hash3(building.id * 31 + cell.column, cell.floor, 211) > WINDOW_DISCS[name]) return
        const palette = windowIsWarm(building, cell) ? mood.warm : mood.cold
        const flicker = hash3(cell.column, cell.floor, 213) < 0.06
        add(cell.x + cell.w / 2, cell.y + cell.h / 2, palette[(cell.floor + cell.column) % palette.length], 0.12 + 0.2 * lit, flicker ? 'flicker' : 'twinkle')
      })
    }
    if (mood.neon > 0.3) {
      for (const sign of building.signs) {
        // One or two bright spots per sign (a tube's hottest stretch), not a string of beads.
        const count = sign.kind === 'vertical' && sign.y1 - sign.y0 > base * 8 ? 2 : 1
        for (let index = 0; index < count; index += 1) {
          const x = sign.x0 + (sign.x1 - sign.x0) * rng.range(0.2, 0.8)
          const y = sign.y0 + (sign.y1 - sign.y0) * rng.range(0.15, 0.85)
          add(x, y, NEON[sign.colour], 0.3 + rng.range(0, 0.25), hash3(sign.seed, index, 7) < 0.12 ? 'flicker' : 'steady', { hex: rng.chance(0.25), radius: base * rng.range(1, 1.6) })
        }
      }
    }
  }
  if (mood.bokeh > 0.4 && name !== 'far') {
    // Street lamps along the foot of the layer, and on the near street, cars passing both ways.
    const [left, right] = [layer.sheet.left, layer.sheet.right]
    const spacing = name === 'near' ? 11 : 15
    for (let x = left + rng.range(0, spacing); x < right; x += spacing * rng.range(0.8, 1.2)) add(x, ground + (name === 'near' ? 4.2 : 5), SODIUM, 0.3, 'steady')
    if (name === 'near') {
      for (let car = 0; car < 9; car += 1) {
        const x = rng.range(left, right)
        const way = rng.chance(0.5) ? 1 : -1
        const speed = way * rng.range(7, 13)
        add(x, ground + 0.8, way > 0 ? '#fff1d6' : '#ff3324', 0.55, 'moving', { speed, radius: base * 0.8 })
        add(x - way * 2.6, ground + 0.8, way > 0 ? '#ff3324' : '#fff1d6', 0.45, 'moving', { speed, radius: base * 0.8 })
      }
    }
  }
  if (layer.rail !== null && mood.bokeh > 0.4) {
    // A train on the elevated line: a row of lit windows sliding along the viaduct.
    const start = rng.range(layer.sheet.left, layer.sheet.right)
    const speed = rng.chance(0.5) ? 9 : -9
    for (let car = 0; car < 14; car += 1) add(start + car * 2.2, layer.rail + 1.6, car === 0 ? '#ffffff' : '#cfeaff', 0.42, 'moving', { speed, radius: base * 0.75 })
  }
  return trimToBudget(lights, LIGHT_BUDGET[name])
}

/** Keeps beacons and moving lights; thins the rest evenly if there are too many. */
function trimToBudget(lights: Light[], budget: number): Light[] {
  if (lights.length <= budget) return lights
  const keep = lights.filter((light) => light.kind === 'blink' || light.kind === 'moving')
  const rest = lights.filter((light) => light.kind !== 'blink' && light.kind !== 'moving')
  const room = Math.max(0, budget - keep.length)
  const step = rest.length / Math.max(1, room)
  const thinned = Array.from({ length: Math.min(room, rest.length) }, (_, index) => rest[Math.floor(index * step)])
  return [...keep, ...thinned].slice(0, budget)
}

/** Aircraft crossing high over the city, blinking as they go. */
export function skyLights(levelWidth: number, ground: number, mood: Mood, seed: number): Light[] {
  const rng = createRng(seed * 13 + 5)
  const z = SKY_Z + 20
  const [left, right] = spanAt(z, levelWidth)
  const count = mood.name === 'overcast' ? 1 : 2
  return Array.from({ length: count }, () => ({
    x: rng.range(left, right),
    y: ground + rng.range(170, 300),
    z,
    radius: blurRadius(z) * 0.7,
    colour: rng.chance(0.5) ? '#ffffff' : AVIATION,
    strength: 0.8,
    kind: 'flying' as const,
    hex: false,
    phase: rng.range(0, 100),
    speed: (rng.chance(0.5) ? 1 : -1) * rng.range(2.5, 4),
  }))
}
