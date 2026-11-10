import {
  Box3, Color, FrontSide, GLSL3, LinearFilter, Matrix3, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, NoColorSpace, NormalBlending,
  OrthographicCamera, Scene, ShaderMaterial, SRGBColorSpace, Vector3, WebGLRenderTarget, BufferGeometry, type Material, type Texture,
  type WebGLRenderer,
} from 'three'
import { OBLIQUE } from '../style/cameraRig'

/**
 * Furniture as flat pre-rendered cards. The camera never turns, so each prop shape is drawn once, from the game's own
 * viewing direction, into a page of an atlas: its colour, its surface normal and depth (so it still takes light from
 * the room's lamps, gets inked by the outline pass and hides people behind it exactly where the 3D model would), its
 * glow, roughness and metalness. The props layer then draws a region's cards as one set of camera-facing quads.
 *
 * Two ways of seeing exist. The pixel looks draw the building with a slightly leaning (oblique) orthographic camera,
 * which is an affine projection, so a card baked with the same lean is exact anywhere on screen. The other looks use
 * perspective, where a card can only be right at the centre of the screen; there only small props become cards.
 */

export type CardView = 'oblique' | 'straight'

let view: CardView = 'oblique'
let viewVersion = 0

/** The renderer sets this from the look; a change makes the props layer rebuild its regions with the right cards. */
export function setCardView(next: CardView): void {
  if (next === view) return
  view = next
  viewVersion += 1
}

export function cardView(): CardView {
  return view
}

export function cardViewVersion(): number {
  return viewVersion
}

/** One drawable piece of a prop, in the prop's own space. */
export type CardPiece = { geometry: BufferGeometry; material: Material; matrix: Matrix4; start: number; count: number }

/**
 * A baked card. The quad lies in the plane z = `front` of the prop's own space, covering x0..x1 by y0..y1; `uv` is
 * its rectangle on page `page`, and `depth` is how far behind the quad the deepest baked point lies.
 */
export type Card = { page: number; uv: [number, number, number, number]; x0: number; y0: number; x1: number; y1: number; front: number; depth: number }

const PAGE_SIZE = 2048
/** Texels per tile: the pixel looks draw about 15 (22 in pixel-hd) art pixels per tile, the others up to about 50 screen pixels. */
const DENSITY: Record<CardView, number> = { oblique: 24, straight: 40 }
/** A gap around each card, so linear filtering never reads a neighbour. */
const PAD = 2
/** Glow is stored divided by this, so an 8-bit page still holds lamps strong enough to bloom. */
export const GLOW_RANGE = 8

/** One atlas page: three colour attachments drawn together (colour and coverage; normal, depth and metalness; glow and roughness). */
export class CardPage {
  readonly target: WebGLRenderTarget
  private shelfY = 0
  private shelfX = 0
  private shelfH = 0

  constructor() {
    this.target = new WebGLRenderTarget(PAGE_SIZE, PAGE_SIZE, { count: 3, depthBuffer: true, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter })
    const [albedo, normal, glow] = this.target.textures
    albedo.colorSpace = SRGBColorSpace
    normal.colorSpace = NoColorSpace
    glow.colorSpace = NoColorSpace
  }

  get albedo(): Texture {
    return this.target.textures[0]
  }

  get normal(): Texture {
    return this.target.textures[1]
  }

  get glow(): Texture {
    return this.target.textures[2]
  }

  /** Finds room for a w x h texel rectangle (shelf packing: cards fill rows left to right), or null when full. */
  place(w: number, h: number): { x: number; y: number } | null {
    if (this.shelfX + w > PAGE_SIZE) {
      this.shelfY += this.shelfH
      this.shelfX = 0
      this.shelfH = 0
    }
    if (this.shelfY + h > PAGE_SIZE || w > PAGE_SIZE) return null
    const at = { x: this.shelfX, y: this.shelfY }
    this.shelfX += w
    this.shelfH = Math.max(this.shelfH, h)
    return at
  }

  dispose(): void {
    this.target.dispose()
  }
}

const BAKE_VERTEX = /* glsl */ `
  uniform mat3 mapTransform;
  uniform mat3 glowMapTransform;
  out vec2 vMapUv;
  out vec2 vGlowUv;
  out vec3 vNormal;
  out vec3 vColor;
  out float vViewZ;
  void main() {
    vMapUv = (mapTransform * vec3(uv, 1.0)).xy;
    vGlowUv = (glowMapTransform * vec3(uv, 1.0)).xy;
    vNormal = normalize(normalMatrix * normal);
    #ifdef USE_COLOR
      vColor = color.rgb;
    #else
      vColor = vec3(1.0);
    #endif
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewZ = mv.z;
    gl_Position = projectionMatrix * mv;
  }`

const BAKE_FRAGMENT = /* glsl */ `
  uniform vec3 diffuse;
  uniform float opacity;
  uniform vec3 glow;
  uniform float roughness;
  uniform float metalness;
  uniform float alphaCut;
  uniform float frontZ;
  uniform float depthSpan;
  #ifdef USE_MAP
    uniform sampler2D map;
  #endif
  #ifdef USE_GLOWMAP
    uniform sampler2D glowMap;
  #endif
  in vec2 vMapUv;
  in vec2 vGlowUv;
  in vec3 vNormal;
  in vec3 vColor;
  in float vViewZ;
  layout(location = 0) out vec4 outAlbedo;
  layout(location = 1) out vec4 outNormal;
  layout(location = 2) out vec4 outGlow;
  void main() {
    vec4 colour = vec4(diffuse * vColor, opacity);
    #ifdef USE_MAP
      colour *= texture(map, vMapUv);
    #endif
    if (colour.a < alphaCut) discard;
    vec3 light = glow;
    #ifdef USE_GLOWMAP
      light *= texture(glowMap, vGlowUv).rgb;
    #endif
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    outAlbedo = colour;
    outNormal = vec4(n.xy * 0.5 + 0.5, clamp((frontZ - vViewZ) / depthSpan, 0.0, 1.0), metalness);
    outGlow = vec4(min(light / ${GLOW_RANGE.toFixed(1)}, vec3(1.0)), roughness);
  }`

const bakeMaterials = new WeakMap<Material, ShaderMaterial>()
const frame = { front: { value: 0 }, span: { value: 1 } }
const IDENTITY_UV = new Matrix3()

/** True for materials a card can reproduce: the standard ones (lit) and plain unlit colours. */
export function canBake(material: Material): boolean {
  return material instanceof MeshStandardMaterial || (material instanceof MeshBasicMaterial && material.type === 'MeshBasicMaterial')
}

function textureTransform(texture: Texture | null): Matrix3 {
  if (!texture) return IDENTITY_UV
  texture.updateMatrix()
  return texture.matrix
}

/** A bake stand-in for a prop material, made once per material: same colour, texture, glow and surface values. */
function bakeMaterialFor(source: Material): ShaderMaterial {
  const known = bakeMaterials.get(source)
  if (known) return known
  const standard = source instanceof MeshStandardMaterial ? source : null
  const basic = source as MeshBasicMaterial
  const map = (standard ?? basic).map ?? null
  // An unlit colour shines by itself: on a card it becomes glow over black.
  const unlit = !standard
  const glow = standard ? standard.emissive.clone().multiplyScalar(standard.emissiveIntensity) : basic.color.clone()
  const glowMap = standard?.emissiveMap ?? (unlit ? map : null)
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: BAKE_VERTEX,
    fragmentShader: BAKE_FRAGMENT,
    defines: { ...(map && !unlit ? { USE_MAP: '' } : {}), ...(glowMap ? { USE_GLOWMAP: '' } : {}) },
    uniforms: {
      diffuse: { value: unlit ? new Color(0, 0, 0) : (standard as MeshStandardMaterial).color },
      opacity: { value: source.opacity },
      glow: { value: glow },
      roughness: { value: standard?.roughness ?? 1 },
      metalness: { value: standard?.metalness ?? 0 },
      alphaCut: { value: source.alphaTest > 0 ? source.alphaTest : 0.01 },
      map: { value: map },
      mapTransform: { value: textureTransform(map) },
      glowMap: { value: glowMap },
      glowMapTransform: { value: textureTransform(glowMap) },
      frontZ: frame.front,
      depthSpan: frame.span,
    },
    vertexColors: source.vertexColors,
    side: source.side ?? FrontSide,
    transparent: source.transparent,
    depthWrite: !source.transparent,
    blending: NormalBlending,
  })
  bakeMaterials.set(source, material)
  return material
}

/** Bounds of the pieces in the prop's own space. */
export function piecesBounds(pieces: readonly CardPiece[]): Box3 {
  const bounds = new Box3()
  const box = new Box3()
  for (const piece of pieces) {
    if (!piece.geometry.boundingBox) piece.geometry.computeBoundingBox()
    bounds.union(box.copy(piece.geometry.boundingBox!).applyMatrix4(piece.matrix))
  }
  return bounds
}

const pages: CardPage[] = []
const cards = new Map<string, Card | null>()
const bakeScene = new Scene()
const bakeCamera = new OrthographicCamera()
/** The bake camera stands this far in front of the card plane. */
const STAND_OFF = 10

export function cardPage(index: number): CardPage {
  return pages[index]
}

/** The card already baked for `key` in the current view (null: tried, cannot be a card), or undefined if not baked yet. */
export function knownCard(key: string): Card | null | undefined {
  return cards.get(`${view}|${key}`)
}

/** Bakes (once per key and view) the card for a prop made of `pieces`. Null when it does not fit a page. */
export function bakeCard(renderer: WebGLRenderer, key: string, pieces: readonly CardPiece[]): Card | null {
  const cacheKey = `${view}|${key}`
  const known = cards.get(cacheKey)
  if (known !== undefined) return known
  const card = bake(renderer, pieces)
  cards.set(cacheKey, card)
  return card
}

function bake(renderer: WebGLRenderer, pieces: readonly CardPiece[]): Card | null {
  const bounds = piecesBounds(pieces)
  if (bounds.isEmpty()) return null
  const depth = Math.max(bounds.max.z - bounds.min.z, 0.01)
  const lean = view === 'oblique' ? OBLIQUE : 0
  // Leaning, points further back are drawn higher: the top edge grows by the lean times the depth.
  const x0 = bounds.min.x
  const x1 = bounds.max.x
  const y0 = bounds.min.y
  const y1 = bounds.max.y + lean * depth
  const density = DENSITY[view]
  const w = Math.ceil((x1 - x0) * density) + PAD * 2
  const h = Math.ceil((y1 - y0) * density) + PAD * 2
  const slot = findSlot(w, h)
  if (!slot) return null
  // The texel rectangle is a whole number of texels; the card's own rectangle grows to match it exactly.
  const padWorld = PAD / density
  const card: Card = {
    page: slot.page,
    uv: [slot.x / PAGE_SIZE, slot.y / PAGE_SIZE, (slot.x + w) / PAGE_SIZE, (slot.y + h) / PAGE_SIZE],
    x0: x0 - padWorld, y0: y0 - padWorld, x1: x0 - padWorld + w / density, y1: y0 - padWorld + h / density,
    front: bounds.max.z, depth,
  }
  draw(renderer, pieces, card, slot, w, h, lean)
  return card
}

function findSlot(w: number, h: number): { page: number; x: number; y: number } | null {
  if (w > PAGE_SIZE || h > PAGE_SIZE) return null
  for (let page = 0; page < pages.length; page += 1) {
    const at = pages[page].place(w, h)
    if (at) return { page, ...at }
  }
  pages.push(new CardPage())
  const at = pages[pages.length - 1].place(w, h)
  return at ? { page: pages.length - 1, ...at } : null
}

const ranges = new WeakMap<BufferGeometry, Map<string, BufferGeometry>>()

/** The piece's geometry limited to its own range (a part of a multi-material mesh), sharing the vertex data. */
function rangeOf(piece: CardPiece): BufferGeometry {
  const source = piece.geometry
  const whole = source.index ? source.index.count : source.attributes.position.count
  if (piece.start === 0 && piece.count >= whole) return source
  const byRange = ranges.get(source) ?? ranges.set(source, new Map()).get(source)!
  const key = `${piece.start}:${piece.count}`
  let range = byRange.get(key)
  if (!range) {
    range = new BufferGeometry()
    range.index = source.index
    for (const [name, attribute] of Object.entries(source.attributes)) range.setAttribute(name, attribute)
    range.setDrawRange(piece.start, piece.count)
    byRange.set(key, range)
  }
  return range
}

const lean = new Matrix4()
const spot = new Vector3()

function draw(renderer: WebGLRenderer, pieces: readonly CardPiece[], card: Card, slot: { page: number; x: number; y: number }, w: number, h: number, leanBy: number): void {
  // Camera in the prop's own space, looking down -z from in front of the card plane, framing the card's rectangle.
  Object.assign(bakeCamera, { left: card.x0, right: card.x1, bottom: card.y0, top: card.y1, near: 0.01, far: STAND_OFF + card.depth + 1 })
  bakeCamera.position.set(0, 0, card.front + STAND_OFF)
  bakeCamera.lookAt(spot.set(0, 0, card.front))
  bakeCamera.updateMatrixWorld()
  bakeCamera.updateProjectionMatrix()
  // The same lean as the game's orthographic camera, measured from the card plane instead of the walking lane.
  lean.set(1, 0, 0, 0, 0, 1, -leanBy, -leanBy * STAND_OFF, 0, 0, 1, 0, 0, 0, 0, 1)
  bakeCamera.projectionMatrix.multiply(lean)
  bakeCamera.projectionMatrixInverse.copy(bakeCamera.projectionMatrix).invert()
  frame.front.value = -STAND_OFF
  frame.span.value = card.depth

  for (const piece of pieces) {
    const mesh = new Mesh(rangeOf(piece), bakeMaterialFor(piece.material))
    mesh.matrixAutoUpdate = false
    mesh.matrix.copy(piece.matrix)
    mesh.frustumCulled = false
    bakeScene.add(mesh)
  }
  const page = pages[slot.page]
  const target = page.target
  target.viewport.set(slot.x, slot.y, w, h)
  target.scissor.set(slot.x, slot.y, w, h)
  target.scissorTest = true
  const previousTarget = renderer.getRenderTarget()
  const autoClear = renderer.autoClear
  const clearColor = renderer.getClearColor(new Color())
  const clearAlpha = renderer.getClearAlpha()
  const shadows = renderer.shadowMap.autoUpdate
  renderer.shadowMap.autoUpdate = false
  renderer.setRenderTarget(target)
  renderer.setClearColor(0x000000, 0)
  renderer.autoClear = false
  renderer.clear(true, true, false)
  renderer.render(bakeScene, bakeCamera)
  renderer.autoClear = autoClear
  renderer.setClearColor(clearColor, clearAlpha)
  renderer.shadowMap.autoUpdate = shadows
  renderer.setRenderTarget(previousTarget)
  target.scissorTest = false
  bakeScene.clear()
}

/** GPU memory of one page: three 8-bit RGBA textures. */
export const PAGE_BYTES = PAGE_SIZE * PAGE_SIZE * 4 * 3

/** How many pages exist (for the debug readout). */
export function cardPageCount(): number {
  return pages.length
}
