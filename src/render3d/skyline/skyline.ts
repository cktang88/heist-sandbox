import { BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, LinearFilter, Mesh, SRGBColorSpace } from 'three'
import { ATLAS_SIZE, REGIONS } from './atlas'
import { context, makeCanvas } from './canvas'
import { CardList } from './cards'
import { cameraSpan, coverBottom, LAYERS, skySheet, SKY_Z, spanAt, WIDE_FACTOR, type Sheet } from './frame'
import { layOutLayer, type Layer } from './layout'
import { layerLights, skyLights } from './lights'
import { createBackdropMaterial } from './material'
import type { Mood } from './moods'
import { paintLayer } from './paintLayer'
import { paintMist, paintRain, paintSky } from './paintSky'
import { createPixelSkyline } from './pixelSkyline'
import { createRng } from './random'

/**
 * The distant city seen past the building, as if through a lens focused on the walking lane: a sky, three
 * layers of city at rising distance (each hazier and softer than the one before), out-of-focus discs for
 * its lights, mist between the layers and rain in front of them. One texture and one draw call.
 */
export type Skyline = {
  mesh: Mesh
  /** Load-time cost and size, for the record. */
  stats: { milliseconds: number; quads: number; lights: number; textureBytes: number }
  dispose(): void
}

function linear(hex: string): [number, number, number] {
  const colour = new Color(hex)
  return [colour.r, colour.g, colour.b]
}

/** Mist hanging in front of a layer, thickest at the street. */
function mistSheet(z: number, levelWidth: number, ground: number, height: number): Sheet {
  const [left, right] = spanAt(z, levelWidth)
  return { left, right, bottom: coverBottom(ground), top: ground + height }
}

function addSearchlights(cards: CardList, layer: Layer, mood: Mood, seed: number): void {
  if (!mood.searchlights) return
  const rng = createRng(seed * 3 + 1)
  const colour = linear('#a9b8ff').map((channel) => channel * 0.022) as [number, number, number]
  for (let beam = 0; beam < 3; beam += 1) {
    const x = layer.sheet.left + (layer.sheet.right - layer.sheet.left) * rng.range(0.2, 0.8)
    cards.beam([x, layer.ground + 20, SKY_Z + 12], colour, 420, 9, rng.range(0, 6), rng.range(0.05, 0.12))
  }
}

/**
 * `groundRow` is the street's row in the level (y down); `seed` fixes the layout. `pixel` draws it as pixel
 * art for the pixel looks (see pixelSkyline.ts), where the soft blur would turn into dither noise.
 */
export function createSkyline(levelWidth: number, groundRow: number, mood: Mood, seed: number, pixel = false): Skyline {
  const crisp = pixel ? createPixelSkyline(levelWidth, groundRow, mood, seed) : null
  return crisp ?? createSoftSkyline(levelWidth, groundRow, mood, seed)
}

function createSoftSkyline(levelWidth: number, groundRow: number, mood: Mood, seed: number): Skyline {
  const start = performance.now()
  const ground = -groundRow
  const layers = LAYERS.map((spec) => layOutLayer(spec, levelWidth, ground, seed))
  const canvas = makeCanvas(ATLAS_SIZE, ATLAS_SIZE)
  const c = context(canvas)
  const sky = skySheet(levelWidth, ground)
  paintSky(c, sky, ground, mood, seed)
  paintMist(c)
  if (mood.rain) paintRain(c, seed)
  for (const layer of layers) paintLayer(c, layer, mood)

  const cards = new CardList()
  let lights = 0
  cards.card(sky, SKY_Z, REGIONS.sky)
  for (const light of skyLights(levelWidth, ground, mood, seed)) cards.light(light, linear(light.colour), 1)
  addSearchlights(cards, layers[0], mood, seed)
  const haze = linear(mood.haze)
  for (const layer of layers) {
    const region = REGIONS[layer.spec.name]
    cards.skirt(layer.sheet, coverBottom(ground), layer.spec.z, region)
    cards.card(layer.sheet, layer.spec.z, region)
    const list = layerLights(layer, mood, seed)
    lights += list.length
    for (const light of list) cards.light(light, linear(light.colour), mood.bokeh)
    if (layer.spec.name !== 'near') {
      // A veil of drifting mist just in front of the far and middle layers.
      const z = layer.spec.z + (layer.spec.name === 'far' ? 60 : 35)
      cards.veil(mistSheet(z, levelWidth, ground, layer.spec.name === 'far' ? 120 : 60), z, 0, layer.spec.name === 'far' ? 90 : 50, haze, mood.mist * 0.55)
    }
  }
  if (mood.rain) {
    const z = -100
    const [left, right] = spanAt(z, levelWidth)
    cards.veil({ left, right, bottom: coverBottom(ground), top: sky.top }, z, 1, 26, linear('#b8c4dc'), 0.16)
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(cards.positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(cards.uvs, 2))
  geometry.setAttribute('tint', new Float32BufferAttribute(cards.tints, 4))
  geometry.setAttribute('extra', new Float32BufferAttribute(cards.extras, 4))
  geometry.setIndex(cards.indices)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  // Kept premultiplied as the canvas holds it: un-premultiplying the faint tails of the blur gives them
  // garbage colours, which filtering then smears into bright fringes around every silhouette.
  texture.premultiplyAlpha = true
  // Seen at or above one texel per pixel everywhere, so no mipmaps (a third less memory, no load-time cost).
  texture.generateMipmaps = false
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  const material = createBackdropMaterial(texture, cameraSpan(levelWidth), WIDE_FACTOR)
  const mesh = new Mesh(geometry, material)
  // Moving parts are placed by the shader, so the box three.js would test against the view is meaningless.
  mesh.frustumCulled = false
  // Drawn before every other see-through thing (glass, smoke): it is behind all of them.
  mesh.renderOrder = -1000
  mesh.matrixAutoUpdate = false
  mesh.onBeforeRender = () => {
    material.uniforms.time.value = (performance.now() / 1000) % 3600
  }
  return {
    mesh,
    stats: { milliseconds: performance.now() - start, quads: cards.quads, lights, textureBytes: ATLAS_SIZE * ATLAS_SIZE * 4 },
    dispose() {
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
  }
}
