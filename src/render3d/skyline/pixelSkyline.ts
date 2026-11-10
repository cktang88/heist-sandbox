import {
  BufferGeometry,
  CanvasTexture,
  DataTexture,
  Float32BufferAttribute,
  FloatType,
  Mesh,
  NearestFilter,
  NoColorSpace,
  RGBAFormat,
  Vector2,
  type ShaderMaterial,
  type WebGLRenderer,
} from 'three'
import type { TimeOfDay } from '../../game/site'
import { PALETTE } from '../style/palette'
import { ATLAS_SIZE } from './atlas'
import { context, makeCanvas } from './canvas'
import { cameraSpan, coverBottom, LAYERS, skySheet, SKY_Z, spanAt, WIDE_FACTOR, type Sheet } from './frame'
import { layOutLayer } from './layout'
import { layerLights, skyLights, LIGHT_KINDS } from './lights'
import type { Mood } from './moods'
import { packLayers, pixelSheets, sheetOf, texelAt, type PixelSheet } from './pixelFrame'
import { pixelLights, type PixelLight } from './pixelLights'
import { createPixelMaterial, MAX_BANDS, PIXEL_MODE } from './pixelMaterial'
import { PIXEL_MOODS, type PixelMood } from './pixelMoods'
import { paintPixelLayer } from './pixelPaint'
import { colourTable, cornerVignette, TABLE_ROWS, type Ink } from './pixelPalette'
import { LOOKS } from '../core/looks'
import type { Skyline } from './skyline'

/**
 * The backdrop for the pixel look: the same city as the soft one (same layout, same lights), drawn as
 * deliberate pixel art that survives the palette pass. Flat silhouettes in one or two palette inks per
 * layer, crisp window cells, bold signs, flat haze bands, a banded sky with a short ordered-dither edge
 * between bands, and bokeh as small flat discs. One texture of palette indices, one tiny colour table,
 * one draw call.
 */

class Quads {
  readonly positions: number[] = []
  readonly uvs: number[] = []
  readonly extras: number[] = []
  readonly inks: number[] = []
  readonly indices: number[] = []
  count = 0

  add(corners: readonly (readonly [number, number, number])[], uvs: readonly (readonly [number, number])[], extra: readonly number[], inks: readonly number[]): void {
    const first = this.count * 4
    for (let corner = 0; corner < 4; corner += 1) {
      this.positions.push(...corners[corner])
      this.uvs.push(...uvs[corner])
      this.extras.push(...extra)
      this.inks.push(...inks)
    }
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
    this.count += 1
  }

  rect(sheet: Sheet, z: number, uvs: readonly (readonly [number, number])[], extra: readonly number[], inks: readonly number[] = [0, 0, 0, 0]): void {
    this.add([[sheet.left, sheet.bottom, z], [sheet.right, sheet.bottom, z], [sheet.right, sheet.top, z], [sheet.left, sheet.top, z]], uvs, extra, inks)
  }

  light(light: PixelLight): void {
    const centre: [number, number, number] = [light.x, light.y, light.z]
    const kind = LIGHT_KINDS.indexOf(light.kind) + (light.hex ? 10 : 0)
    this.add([centre, centre, centre, centre], [[-1, -1], [1, -1], [1, 1], [-1, 1]], [PIXEL_MODE.light, light.phase, kind, light.speed], [light.body, light.rim, light.size, 0])
  }
}

/** Copies a painted layer into the atlas, piece by piece, and adds one quad per piece. */
function placeLayer(atlas: CanvasRenderingContext2D, quads: Quads, sheet: PixelSheet, canvas: HTMLCanvasElement, pieces: ReturnType<typeof packLayers>, index: number): void {
  for (const piece of pieces ?? []) {
    if (piece.layer !== index) continue
    atlas.drawImage(canvas, piece.x, 0, piece.w, sheet.height, piece.atlasX, piece.atlasY, piece.w, sheet.height)
    const left = sheet.left + piece.x * sheet.texel
    const world: Sheet = { left, right: left + piece.w * sheet.texel, bottom: sheet.bottom, top: sheet.bottom + sheet.height * sheet.texel }
    const [u0, u1] = [piece.atlasX / ATLAS_SIZE, (piece.atlasX + piece.w) / ATLAS_SIZE]
    const [v0, v1] = [1 - (piece.atlasY + sheet.height) / ATLAS_SIZE, 1 - piece.atlasY / ATLAS_SIZE]
    quads.rect(world, sheet.z, [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], [PIXEL_MODE.card, 0, 0, 0])
  }
}

function setSkyUniforms(material: ShaderMaterial, mood: Mood, pixel: PixelMood, sky: Sheet, ground: number): void {
  const texel = texelAt(SKY_Z)
  const row = (height: number) => (ground + height - sky.bottom) / texel
  const u = material.uniforms
  const bands = pixel.sky.slice(0, MAX_BANDS)
  u.bandStart.value = [...bands.map(([height]) => row(height)), ...new Array<number>(MAX_BANDS - bands.length).fill(-1e6)]
  u.bandInk.value = [...bands.map(([, ink]) => ink), ...new Array<number>(MAX_BANDS - bands.length).fill(0)]
  u.bandCount.value = bands.length
  u.stars.value = pixel.stars ? [row(150), pixel.stars.ink, pixel.stars.bright, pixel.stars.density] : [0, 0, 0, 0]
  if (pixel.disc && mood.disc) {
    const x = ((sky.right - sky.left) * mood.disc.across) / texel
    u.disc.value = [x, row(mood.disc.height), Math.max(3, Math.round((mood.disc.size * 0.9) / texel)), pixel.disc.reach]
    u.discInks.value = [pixel.disc.body, pixel.disc.rim, pixel.disc.halo]
  }
  u.clouds.value = [row(80), row(200), pixel.clouds.cover, pixel.clouds.under ? 1 : 0]
  u.cloudInks.value = [pixel.clouds.body, pixel.clouds.edge]
  u.rainInk.value = pixel.rain ?? 0
}

/** Every ink the sky shader can pick. */
function skyInks(pixel: PixelMood): Ink[] {
  const { stars, disc, clouds, rain } = pixel
  return [
    ...pixel.sky.map(([, ink]) => ink),
    ...(stars ? [stars.ink, stars.bright] : []),
    ...(disc ? [disc.body, disc.rim, disc.halo] : []),
    clouds.body,
    clouds.edge,
    ...(rain === null ? [] : [rain]),
  ]
}

function tableTexture(time: TimeOfDay, inks: Iterable<Ink>): DataTexture {
  const texture = new DataTexture(colourTable(time, inks), PALETTE.length, TABLE_ROWS, RGBAFormat, FloatType)
  texture.colorSpace = NoColorSpace
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.needsUpdate = true
  return texture
}

/** Returns null when the layers do not fit the atlas (a much wider level than the complex); the soft backdrop is used then. */
export function createPixelSkyline(levelWidth: number, groundRow: number, mood: Mood, seed: number): Skyline | null {
  const start = performance.now()
  const ground = -groundRow
  const pixel = PIXEL_MOODS[mood.name]
  const sheets = pixelSheets(levelWidth, ground)
  const pieces = packLayers(sheets, ATLAS_SIZE)
  if (!pieces) return null
  const layers = LAYERS.map((spec) => layOutLayer(spec, levelWidth, ground, seed))
  const canvas = makeCanvas(ATLAS_SIZE, ATLAS_SIZE)
  const atlas = context(canvas)
  atlas.imageSmoothingEnabled = false

  const quads = new Quads()
  const used = new Set<Ink>(skyInks(pixel))
  const sky = skySheet(levelWidth, ground)
  const skyTexel = texelAt(SKY_Z)
  quads.rect(sky, SKY_Z, [[0, 0], [(sky.right - sky.left) / skyTexel, 0], [(sky.right - sky.left) / skyTexel, (sky.top - sky.bottom) / skyTexel], [0, (sky.top - sky.bottom) / skyTexel]], [PIXEL_MODE.sky, 0, 0, 0])
  for (const light of pixelLights(skyLights(levelWidth, ground, mood, seed), 'far', pixel)) {
    quads.light({ ...light, size: 1 })
    used.add(light.body).add(light.rim)
  }
  let lights = 0
  layers.forEach((layer, index) => {
    const sheet = sheets[index]
    const inks = pixel.layers[layer.spec.name]
    // Below the painted street, a flat street colour down to where the view can reach.
    const painted = sheetOf(sheet)
    quads.rect({ ...painted, top: painted.bottom + sheet.texel, bottom: coverBottom(ground) }, sheet.z, [[0, 0], [0, 0], [0, 0], [0, 0]], [PIXEL_MODE.flat, 0, 0, 0], [inks.haze, 0, 0, 0])
    used.add(inks.haze)
    placeLayer(atlas, quads, sheet, paintPixelLayer(layer, sheet, pixel, mood.lit, used), pieces, index)
    const list = pixelLights(layerLights(layer, mood, seed), layer.spec.name, pixel)
    lights += list.length
    for (const light of list) {
      quads.light(light)
      used.add(light.body).add(light.rim)
    }
    if (layer.spec.name === 'mid' && pixel.rain !== null) {
      const z = -100
      const [left, right] = spanAt(z, levelWidth)
      quads.rect({ left, right, bottom: coverBottom(ground), top: sky.top }, z, [[0, 0], [1, 0], [1, 1], [0, 1]], [PIXEL_MODE.rain, 0, 0, 0])
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(quads.positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(quads.uvs, 2))
  geometry.setAttribute('extra', new Float32BufferAttribute(quads.extras, 4))
  geometry.setAttribute('inks', new Float32BufferAttribute(quads.inks, 4))
  geometry.setIndex(quads.indices)
  const texture = new CanvasTexture(canvas)
  // Indices, not colours: no colour conversion, no filtering, no mipmaps.
  texture.colorSpace = NoColorSpace
  texture.premultiplyAlpha = false
  texture.generateMipmaps = false
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  const table = tableTexture(pixel.time, used)
  const material = createPixelMaterial({
    atlas: texture,
    table,
    vignette: LOOKS[pixel.time].grade.vignette,
    corner: cornerVignette(pixel.time),
    span: cameraSpan(levelWidth),
    wideFactor: WIDE_FACTOR,
  })
  setSkyUniforms(material, mood, pixel, sky, ground)
  const mesh = new Mesh(geometry, material)
  mesh.frustumCulled = false
  mesh.renderOrder = -1000
  mesh.matrixAutoUpdate = false
  const size = new Vector2()
  mesh.onBeforeRender = (renderer: WebGLRenderer) => {
    material.uniforms.time.value = (performance.now() / 1000) % 3600
    // Snapping needs the size of the art-pixel buffer being drawn into.
    const target = renderer.getRenderTarget()
    if (target) material.uniforms.artSize.value.set(target.width, target.height)
    else material.uniforms.artSize.value.copy(renderer.getDrawingBufferSize(size))
  }
  return {
    mesh,
    stats: { milliseconds: performance.now() - start, quads: quads.count, lights, textureBytes: ATLAS_SIZE * ATLAS_SIZE * 4 + PALETTE.length * TABLE_ROWS * 16 },
    dispose() {
      geometry.dispose()
      material.dispose()
      texture.dispose()
      table.dispose()
    },
  }
}
