import {
  BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace,
  type Material, type Texture,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { photoTexture as sharedPhoto } from '../core/photos'
import { BOX, CYLINDER, box, matte } from './kit'

/**
 * Shared pieces for the industrial, security and exterior prop models: photo-textured paints, canvas-drawn
 * labels and screens, and helpers for rods, wheels and repeated parts. Everything here is made once and shared.
 */

const memo = new Map<string, unknown>()
/** Makes something the first time it is asked for and hands back the same one after that. */
export function once<T>(key: string, make: () => T): T {
  if (!memo.has(key)) memo.set(key, make())
  return memo.get(key) as T
}

let builds = 0
/** Picks one of a few looks. A counter hash, so the same site always gets the same mix without randomness. */
export function pick<T>(options: readonly T[]): T {
  builds += 1
  const hash = Math.imul(builds ^ 0x5bd1e995, 0x2c1b3c6d) >>> 0
  return options[(hash >>> 11) % options.length]
}

// ---------- Materials ----------

function photoTexture(dir: string, file: string, repeatX: number, repeatY: number, isColor: boolean): Texture {
  return once(`tex:${dir}:${file}:${repeatX}:${repeatY}`, () => sharedPhoto(`${dir}/${file}.jpg`, repeatX, repeatY, isColor))
}

/** Photo sets in `public/` that make good worn surfaces once tinted. */
const PHOTOS = {
  /** Light grey scuffed steel: tinted, it becomes any colour of worn painted metal. */
  paint: 'textures/steel',
  /** Streaky red-brown rust, like an old shipping container. */
  rust: 'textures2/rusty_painted_metal',
  /** Pale paint with rust blooms; it comes out warm and dirty once tinted. */
  rusty: 'textures2/rusty_metal_02',
  wood: 'textures/wood',
  plate: 'textures2/DiamondPlate001',
  corrugated: 'textures2/corrugated_iron',
  concrete: 'textures/concrete',
} as const
export type PhotoName = keyof typeof PHOTOS

/** A photo-textured surface multiplied by `tint`. Shared per combination, so reuse colours. */
export function photo(name: PhotoName, tint: number, metalness = 0.4, repeatX = 1, repeatY = 1): MeshStandardMaterial {
  return once(`photo:${name}:${tint}:${metalness}:${repeatX}:${repeatY}`, () => new MeshStandardMaterial({
    map: photoTexture(PHOTOS[name], 'color', repeatX, repeatY, true),
    normalMap: photoTexture(PHOTOS[name], 'normal', repeatX, repeatY, false),
    roughnessMap: photoTexture(PHOTOS[name], 'rough', repeatX, repeatY, false),
    color: tint,
    roughness: 1,
    metalness,
  }))
}

/** A material whose picture is drawn on a canvas once. `glowing` also uses the picture as light (screens, signs). */
export function drawn(key: string, width: number, height: number, draw: (c: CanvasRenderingContext2D) => void, options: {
  glowing?: number; roughness?: number; metalness?: number; transparent?: boolean; repeatX?: number
} = {}): MeshStandardMaterial {
  return once(`drawn:${key}`, () => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    draw(canvas.getContext('2d')!)
    const map = new CanvasTexture(canvas)
    map.colorSpace = SRGBColorSpace
    map.anisotropy = 4
    if (options.repeatX) {
      map.wrapS = RepeatWrapping
      map.repeat.x = options.repeatX
    }
    const material = new MeshStandardMaterial({
      map, roughness: options.roughness ?? 0.7, metalness: options.metalness ?? 0,
      transparent: options.transparent ?? false, alphaTest: options.transparent ? 0.3 : 0, side: options.transparent ? DoubleSide : 0,
    })
    if (options.glowing) {
      material.emissiveMap = map
      material.emissive.setHex(0xffffff)
      material.emissiveIntensity = options.glowing
    }
    return material
  })
}

/** Common finishes, shared by every set. */
export const FINISH = {
  black: matte(0x121417, 0.6),
  rubber: matte(0x0d0e10, 0.95),
  darkSteel: matte(0x1e2228, 0.45, 0.8),
  steel: matte(0x6d747c, 0.35, 0.9),
  chrome: matte(0xc8ccd0, 0.18, 1),
  brass: matte(0xb08a45, 0.3, 1),
  plastic: matte(0x23272d, 0.45),
  glass: once('glass', () => new MeshStandardMaterial({ color: 0x0e1418, roughness: 0.05, metalness: 0.6 })),
  clearGlass: once('clearGlass', () => new MeshStandardMaterial({ color: 0x9fc4d0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false })),
  gold: once('gold', () => new MeshStandardMaterial({ color: 0xe0a83c, roughness: 0.22, metalness: 1 })),
}

// ---------- Geometry ----------

/** A square frustum (top 70% of the base), flat-shaded: the shape of a gold bar. */
export const FRUSTUM = once('frustum', () => {
  const shape = new CylinderGeometry(0.7 / Math.SQRT2, 1 / Math.SQRT2, 1, 4, 1).rotateY(Math.PI / 4).toNonIndexed()
  shape.computeVertexNormals()
  return shape
})
/** An open tube with no end caps, for labels wrapped round barrels and cylinders. */
export const SLEEVE = new CylinderGeometry(1, 1, 1, 14, 1, true)

/** Turns off shadow casting for small parts, which cost more than they add. */
export function quiet<T extends Mesh>(mesh: T): T {
  mesh.castShadow = false
  return mesh
}

/** A cylinder from (x1, y1) to (x2, y2) at depth z: pipes, legs, rails, handles. */
export function rod(group: Group, material: Material, x1: number, y1: number, x2: number, y2: number, radius: number, z: number): Mesh {
  const mesh = new Mesh(CYLINDER, material)
  const length = Math.hypot(x2 - x1, y2 - y1)
  mesh.scale.set(radius, length, radius)
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z)
  mesh.rotation.z = -Math.atan2(x2 - x1, y2 - y1)
  mesh.castShadow = radius > 0.04
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** A cylinder lying along z (facing the camera): wheels, dials, reels, flanges. */
export function disc(group: Group, material: Material, x: number, y: number, z: number, radius: number, thickness: number): Mesh {
  const mesh = new Mesh(CYLINDER, material)
  mesh.scale.set(radius, thickness, radius)
  mesh.rotation.x = Math.PI / 2
  mesh.position.set(x, y, z)
  mesh.castShadow = radius > 0.15
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** A tyre with a hub, its outer face at depth `z`. */
export function wheel(group: Group, x: number, radius: number, z: number, width = 0.22, hub: Material = FINISH.steel): void {
  disc(group, FINISH.rubber, x, radius, z - width / 2, radius, width)
  quiet(disc(group, hub, x, radius, z + 0.005, radius * 0.55, 0.02))
}

/** One geometry made of many unit boxes, merged once so repeated parts (bars, fins, slats) cost a single draw. */
export function mergedBoxes(key: string, boxes: readonly (readonly [number, number, number, number, number, number])[]): BufferGeometry {
  return once(`boxes:${key}`, () => mergeGeometries(boxes.map(([left, bottom, w, h, depth, z]) => {
    const piece = BOX.clone()
    piece.scale(w, h, depth)
    piece.translate(left + w / 2, bottom + h / 2, z)
    return piece
  })))
}

/** A piece of a merged shape: centre x, y, z, size along x, y, z, and an optional tilt about z. */
export type Piece = readonly [number, number, number, number, number, number, number?]

/** Many copies of one shape (balls, frustums) merged once into a single geometry: sandbags, gold bars. */
export function mergedPieces(key: string, base: BufferGeometry, pieces: readonly Piece[]): BufferGeometry {
  return once(`pieces:${key}`, () => mergeGeometries(pieces.map(([x, y, z, w, h, depth, tilt]) => {
    const piece = base.clone()
    piece.scale(w, h, depth)
    if (tilt) piece.rotateZ(tilt)
    piece.translate(x, y, z)
    return piece
  })))
}

/** Places a merged geometry built in final coordinates. */
export function place(group: Group, geometry: BufferGeometry, material: Material, castShadow = true): Mesh {
  const mesh = new Mesh(geometry, material)
  mesh.castShadow = castShadow
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

// ---------- Canvas pictures ----------

/** Diagonal black and yellow warning stripes. */
export function stripes(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = '#d9a91a', b = '#15130f', step = 16): void {
  c.save()
  c.beginPath()
  c.rect(x, y, w, h)
  c.clip()
  c.fillStyle = a
  c.fillRect(x, y, w, h)
  c.fillStyle = b
  for (let offset = -h; offset < w + h; offset += step * 2) {
    c.beginPath()
    c.moveTo(x + offset, y + h)
    c.lineTo(x + offset + step, y + h)
    c.lineTo(x + offset + step + h, y)
    c.lineTo(x + offset + h, y)
    c.fill()
  }
  c.restore()
}

/** A diamond hazard placard with a pictogram letter or symbol. */
export function placard(c: CanvasRenderingContext2D, cx: number, cy: number, size: number, fill: string, symbol: string, ink = '#111'): void {
  c.save()
  c.translate(cx, cy)
  c.rotate(Math.PI / 4)
  c.fillStyle = '#f2f0ea'
  c.fillRect(-size / 2, -size / 2, size, size)
  c.fillStyle = fill
  c.fillRect(-size / 2 + size * 0.06, -size / 2 + size * 0.06, size * 0.88, size * 0.88)
  c.restore()
  c.fillStyle = ink
  c.font = `bold ${Math.round(size * 0.5)}px sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(symbol, cx, cy)
}

/** A yellow warning triangle with a symbol, for electrical gear. */
export function warningSign(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, caption: string): void {
  c.fillStyle = '#e8e4d8'
  c.fillRect(x, y, w, h)
  c.fillStyle = '#e2b21c'
  const size = Math.min(w, h * 0.6)
  c.beginPath()
  c.moveTo(x + w / 2, y + h * 0.06)
  c.lineTo(x + w / 2 + size / 2, y + h * 0.06 + size * 0.86)
  c.lineTo(x + w / 2 - size / 2, y + h * 0.06 + size * 0.86)
  c.closePath()
  c.fill()
  c.strokeStyle = '#111'
  c.lineWidth = size * 0.06
  c.stroke()
  c.fillStyle = '#111'
  c.font = `bold ${Math.round(size * 0.45)}px sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText('⚡', x + w / 2, y + h * 0.06 + size * 0.58)
  c.font = `bold ${Math.round(h * 0.13)}px sans-serif`
  c.fillText(caption, x + w / 2, y + h * 0.84)
}

/** Light noise and streaks so painted surfaces drawn on canvas do not look clean. */
export function grime(c: CanvasRenderingContext2D, w: number, h: number, amount = 0.25, seed = 1): void {
  let state = seed * 9973
  const next = () => ((state = (state * 16807) % 2147483647) / 2147483647)
  for (let index = 0; index < 160; index += 1) {
    c.fillStyle = `rgba(30,22,14,${next() * amount * 0.5})`
    const x = next() * w
    c.fillRect(x, next() * h, 1 + next() * 3, next() * h * 0.3)
  }
  for (let index = 0; index < 400; index += 1) {
    c.fillStyle = `rgba(${next() > 0.5 ? '255,255,255' : '0,0,0'},${next() * amount * 0.25})`
    c.fillRect(next() * w, next() * h, 2, 2)
  }
}

/** A small seeded random source for canvas drawings (they are drawn once, so this is not per frame). */
export function seeded(seed: number): () => number {
  let state = seed * 48271 + 11
  return () => ((state = (state * 16807) % 2147483647) / 2147483647)
}

// ---------- Industrial pictures: canvas-drawn surfaces, each drawn once on first use ----------

/** Rough timber planks with gaps, grain and a stencil, for crate faces. */
export function crateFace(kind: 'pine' | 'olive') {
  return drawn(`crate:${kind}`, 256, 256, (c) => {
    const base = kind === 'pine' ? [150, 116, 74] : [74, 82, 54]
    const random = seeded(kind === 'pine' ? 3 : 7)
    for (let plank = 0; plank < 5; plank += 1) {
      const shade = 0.82 + random() * 0.3
      c.fillStyle = `rgb(${base.map((v) => Math.round(v * shade)).join(',')})`
      c.fillRect(0, plank * 51, 256, 51)
      c.strokeStyle = 'rgba(40,26,12,0.25)'
      for (let line = 0; line < 9; line += 1) {
        c.beginPath()
        const y = plank * 51 + random() * 51
        c.moveTo(0, y)
        c.bezierCurveTo(80, y + random() * 6 - 3, 170, y + random() * 6 - 3, 256, y + random() * 4 - 2)
        c.stroke()
      }
      c.fillStyle = 'rgba(18,12,6,0.8)'
      c.fillRect(0, plank * 51 + 49, 256, 2)
    }
    c.fillStyle = kind === 'pine' ? 'rgba(25,20,15,0.75)' : 'rgba(225,215,170,0.8)'
    c.font = 'bold 30px monospace'
    c.textAlign = 'center'
    c.fillText(kind === 'pine' ? 'FRAGILE' : 'CARTRIDGES', 128, 118)
    c.font = 'bold 18px monospace'
    c.fillText(kind === 'pine' ? '↑↑  LOT 4471-B  ↑↑' : '5.56MM  BALL  M855', 128, 150)
    if (kind === 'olive') c.fillText('LOT KX-0213  1440 RDS', 128, 174)
    grime(c, 256, 256, 0.4, kind === 'pine' ? 2 : 5)
  })
}

/** Brown cardboard carton with tape, print and a shipping label. */
export function cartonFace(kind: 'kraft' | 'white') {
  return drawn(`carton:${kind}`, 256, 256, (c) => {
    c.fillStyle = kind === 'kraft' ? '#9c7748' : '#cfc9bb'
    c.fillRect(0, 0, 256, 256)
    grime(c, 256, 256, 0.3, kind === 'kraft' ? 4 : 9)
    c.fillStyle = kind === 'kraft' ? 'rgba(200,170,110,0.55)' : 'rgba(150,140,120,0.5)'
    c.fillRect(112, 0, 32, 256)
    c.fillStyle = 'rgba(25,25,25,0.8)'
    c.font = 'bold 22px sans-serif'
    c.fillText(kind === 'kraft' ? '↑ ↑' : 'KAIJU-TEK', 18, 40)
    c.font = '14px sans-serif'
    c.fillText(kind === 'kraft' ? 'HANDLE WITH CARE' : 'COMPONENTS 24x', 18, 62)
    c.fillStyle = '#ece8de'
    c.fillRect(160, 170, 80, 56)
    c.fillStyle = '#222'
    for (let bar = 0; bar < 30; bar += 1) c.fillRect(166 + bar * 2.3, 200, (bar * 7) % 3 === 0 ? 2 : 1, 20)
    c.fillRect(166, 178, 50, 4)
    c.fillRect(166, 186, 36, 4)
    c.strokeStyle = 'rgba(40,30,20,0.35)'
    c.lineWidth = 3
    c.strokeRect(1, 1, 254, 254)
  })
}

/** The front of a rack of servers: drive bays and vents, with status lights that glow. */
export function serverFront(variant: number) {
  return drawn(`server:${variant}`, 128, 512, (c) => {
    const random = seeded(variant + 21)
    c.fillStyle = '#060708'
    c.fillRect(0, 0, 128, 512)
    let y = 12
    while (y < 490) {
      const units = random() < 0.6 ? 1 : random() < 0.7 ? 2 : 4
      const h = units * 18 - 2
      c.fillStyle = random() < 0.2 ? '#2a2e33' : '#15181c'
      c.fillRect(8, y, 112, h)
      c.fillStyle = 'rgba(160,170,180,0.12)'
      c.fillRect(8, y, 112, 1)
      if (units > 1) {
        for (let bay = 0; bay < 6; bay += 1) {
          c.fillStyle = '#0b0c0e'
          c.fillRect(12 + bay * 17, y + 4, 14, h - 8)
          c.fillStyle = random() < 0.7 ? '#2bff7a' : '#ffb020'
          c.fillRect(14 + bay * 17, y + h - 8, 3, 2)
        }
      } else {
        c.fillStyle = '#0a0b0c'
        for (let slot = 0; slot < 14; slot += 1) c.fillRect(40 + slot * 5, y + 4, 3, h - 8)
        const colours = ['#2bff7a', '#2bff7a', '#3aa8ff', '#ffb020', '#ff3030']
        for (let led = 0; led < 4; led += 1) {
          if (random() < 0.25) continue
          c.fillStyle = colours[Math.floor(random() * (random() < 0.85 ? 3 : 5))]
          c.fillRect(13 + led * 6, y + 6, 3, 3)
        }
      }
      y += h + 2 + (random() < 0.15 ? 18 : 0)
    }
  }, { glowing: 2.2, roughness: 0.5, metalness: 0.4 })
}

/** Stamped louvre slats and a seam, for machine enclosures. */
export function louvres() {
  return drawn('louvres', 128, 128, (c) => {
    c.fillStyle = '#7d7f7c'
    c.fillRect(0, 0, 128, 128)
    for (let y = 6; y < 122; y += 10) {
      c.fillStyle = '#1b1c1c'
      c.fillRect(8, y, 112, 5)
      c.fillStyle = '#a5a7a3'
      c.fillRect(8, y + 5, 112, 2)
    }
    c.strokeStyle = '#3b3c3a'
    c.lineWidth = 3
    c.strokeRect(2, 2, 124, 124)
    grime(c, 128, 128, 0.5, 6)
  }, { roughness: 0.6, metalness: 0.5 })
}

/** Grey cabinet doors with handles, labels and inspection windows: switchgear. */
export function switchgearFront() {
  return drawn('switchgear', 384, 384, (c) => {
    c.fillStyle = '#b9bdbb'
    c.fillRect(0, 0, 384, 384)
    for (let door = 0; door < 3; door += 1) {
      const x = door * 128
      c.strokeStyle = '#3a3d3c'
      c.lineWidth = 3
      c.strokeRect(x + 6, 10, 116, 364)
      c.strokeRect(x + 6, 10, 116, 110)
      c.fillStyle = '#1f2526'
      c.fillRect(x + 30, 30, 68, 40)
      c.fillStyle = '#d8d4c8'
      c.fillRect(x + 30, 80, 68, 16)
      c.fillStyle = '#222'
      c.font = 'bold 12px monospace'
      c.fillText(`Q${door + 1}  400V`, x + 36, 92)
      c.fillStyle = '#2b2d2d'
      c.fillRect(x + 100, 200, 10, 46)
      warningSign(c, x + 34, 270, 60, 72, 'DANGER')
    }
    grime(c, 384, 384, 0.45, 8)
  }, { roughness: 0.55, metalness: 0.35 })
}

/** A dial gauge face with a red sector. */
export function gaugeFace() {
  return drawn('gauge', 64, 64, (c) => {
    c.fillStyle = '#e9e6dc'
    c.beginPath()
    c.arc(32, 32, 30, 0, Math.PI * 2)
    c.fill()
    c.strokeStyle = '#c0281e'
    c.lineWidth = 5
    c.beginPath()
    c.arc(32, 32, 24, -0.4, 0.5)
    c.stroke()
    c.strokeStyle = '#111'
    c.lineWidth = 2
    for (let tick = 0; tick <= 10; tick += 1) {
      const angle = Math.PI * 0.75 + (tick / 10) * Math.PI * 1.5
      c.beginPath()
      c.moveTo(32 + Math.cos(angle) * 22, 32 + Math.sin(angle) * 22)
      c.lineTo(32 + Math.cos(angle) * 27, 32 + Math.sin(angle) * 27)
      c.stroke()
    }
    c.lineWidth = 3
    c.beginPath()
    c.moveTo(32, 32)
    c.lineTo(32 + Math.cos(-0.9) * 22, 32 + Math.sin(-0.9) * 22)
    c.stroke()
  }, { roughness: 0.3 })
}

/** Pegboard with painted tool outlines and tools hanging on it. */
export function pegboard() {
  return drawn('pegboard', 512, 256, (c) => {
    c.fillStyle = '#8a6f4e'
    c.fillRect(0, 0, 512, 256)
    c.fillStyle = 'rgba(30,20,10,0.6)'
    for (let x = 8; x < 512; x += 16) for (let y = 8; y < 256; y += 16) c.fillRect(x, y, 3, 3)
    const tools: [number, number, number, number, string][] = [
      [30, 40, 14, 150, '#b02020'], [70, 30, 10, 120, '#30353a'], [100, 40, 12, 130, '#30353a'], [140, 36, 40, 26, '#c8b020'],
      [150, 70, 12, 110, '#c8b020'], [200, 30, 9, 160, '#8a9096'], [225, 30, 9, 140, '#8a9096'], [250, 30, 9, 120, '#8a9096'],
      [290, 50, 60, 70, '#1d5fa8'], [370, 30, 12, 170, '#5a3a20'], [400, 40, 50, 18, '#30353a'], [410, 60, 14, 110, '#b02020'],
      [460, 40, 26, 90, '#d07020'],
    ]
    for (const [x, y, w, h, colour] of tools) {
      c.fillStyle = 'rgba(15,15,15,0.55)'
      c.fillRect(x + 3, y + 3, w, h)
      c.fillStyle = colour
      c.fillRect(x, y, w, h)
      c.fillStyle = 'rgba(255,255,255,0.15)'
      c.fillRect(x, y, Math.max(2, w * 0.25), h)
    }
    c.strokeStyle = '#f0e8d0'
    c.setLineDash([6, 4])
    c.strokeRect(330, 150, 16, 90)
    c.setLineDash([])
    grime(c, 512, 256, 0.4, 11)
  })
}

/** White lab cabinet doors and drawers with steel pulls. */
export function labCabinets() {
  return drawn('labCabinets', 384, 128, (c) => {
    c.fillStyle = '#d9ddd9'
    c.fillRect(0, 0, 384, 128)
    c.strokeStyle = '#8b908d'
    c.lineWidth = 2
    for (let door = 0; door < 6; door += 1) {
      c.strokeRect(door * 64 + 3, 6, 58, door % 3 === 1 ? 36 : 118)
      if (door % 3 === 1) {
        c.strokeRect(door * 64 + 3, 46, 58, 36)
        c.strokeRect(door * 64 + 3, 86, 58, 38)
      }
      c.fillStyle = '#6d7275'
      c.fillRect(door * 64 + 20, 14, 24, 4)
    }
    c.fillStyle = '#e2b21c'
    c.fillRect(140, 60, 18, 16)
    grime(c, 384, 128, 0.08, 13)
  }, { roughness: 0.45 })
}

/** Rows of archive boxes with labels, seen end-on on a shelf. */
export function archiveBoxes() {
  return drawn('archiveBoxes', 512, 64, (c) => {
    const random = seeded(5)
    let x = 0
    while (x < 512) {
      const w = 34 + random() * 22
      const shade = 0.75 + random() * 0.3
      c.fillStyle = random() < 0.2 ? `rgb(${Math.round(70 * shade)},${Math.round(90 * shade)},${Math.round(120 * shade)})` : `rgb(${Math.round(170 * shade)},${Math.round(140 * shade)},${Math.round(95 * shade)})`
      c.fillRect(x, 64 - (44 + random() * 18), w - 2, 64)
      c.fillStyle = '#ebe6d8'
      c.fillRect(x + 6, 30, w - 14, 14)
      c.fillStyle = '#333'
      c.fillRect(x + 9, 35, (w - 20) * random(), 3)
      c.fillStyle = 'rgba(0,0,0,0.6)'
      c.fillRect(x + w / 2 - 6, 50, 10, 5)
      x += w
    }
  })
}

/** A terminal screen with green text. */
export function terminalScreen() {
  return drawn('terminal', 128, 96, (c) => {
    c.fillStyle = '#031208'
    c.fillRect(0, 0, 128, 96)
    const random = seeded(17)
    c.fillStyle = '#39ff8a'
    for (let line = 0; line < 11; line += 1) c.fillRect(6, 6 + line * 8, 20 + random() * 96, 3)
    c.fillStyle = '#ffb020'
    c.fillRect(6, 86, 40, 4)
  }, { glowing: 1.6, roughness: 0.2 })
}

/** Cooling unit front: perforated panels and a small control display. */
export function coolingFront() {
  return drawn('cooling', 128, 256, (c) => {
    c.fillStyle = '#c9ccc8'
    c.fillRect(0, 0, 128, 256)
    c.fillStyle = '#4b4f50'
    for (let y = 70; y < 240; y += 6) for (let x = 10; x < 118; x += 6) c.fillRect(x, y, 3, 3)
    c.strokeStyle = '#7d8280'
    c.lineWidth = 2
    c.strokeRect(6, 62, 116, 186)
    c.strokeRect(6, 6, 116, 50)
    c.fillStyle = '#0c1a24'
    c.fillRect(20, 16, 50, 26)
    c.fillStyle = '#5fd0ff'
    c.font = 'bold 14px monospace'
    c.fillText('18.5C', 24, 34)
    c.fillStyle = '#2bff7a'
    c.fillRect(84, 22, 6, 6)
    grime(c, 128, 256, 0.1, 19)
  }, { glowing: 0.15, roughness: 0.5 })
}

/** The red danger band round an explosive barrel: stripes, a flame placard and a warning. */
export function flammableBand() {
  return drawn('flammable', 512, 128, (c) => {
    stripes(c, 0, 0, 512, 22)
    stripes(c, 0, 106, 512, 22)
    c.fillStyle = '#e9e3d0'
    c.fillRect(0, 22, 512, 84)
    for (const x of [64, 320]) {
      placard(c, x, 64, 54, '#d42a1e', '🔥', '#111')
      c.fillStyle = '#b81d15'
      c.font = 'bold 26px sans-serif'
      c.textAlign = 'left'
      c.fillText('FLAMMABLE', x + 46, 62)
      c.fillStyle = '#111'
      c.font = 'bold 15px sans-serif'
      c.fillText('UN1203  KEEP AWAY FROM HEAT', x + 46, 84)
    }
  }, { roughness: 0.55, repeatX: 1 })
}

/** Text label round a gas cylinder. */
export function cylinderLabel(gas: string, colour: string) {
  return drawn(`gas:${gas}`, 256, 64, (c) => {
    c.fillStyle = '#ece8dc'
    c.fillRect(0, 0, 256, 64)
    c.fillStyle = colour
    c.fillRect(0, 0, 256, 12)
    c.fillStyle = '#111'
    c.font = 'bold 22px sans-serif'
    c.fillText(gas, 12, 42)
    placard(c, 210, 36, 30, '#d42a1e', '!', '#111')
  })
}

/** A side panel of a delivery van or truck with a made-up company livery. */
export function livery(kind: 'van' | 'truck') {
  return drawn(`livery:${kind}`, 512, 160, (c) => {
    c.fillStyle = kind === 'van' ? '#d9dad6' : '#c8c9c4'
    c.fillRect(0, 0, 512, 160)
    grime(c, 512, 160, 0.15, kind === 'van' ? 23 : 29)
    c.fillStyle = kind === 'van' ? '#c23a2b' : '#1f5c8a'
    c.fillRect(0, 112, 512, 14)
    c.fillStyle = '#1b1d20'
    c.font = 'bold 46px sans-serif'
    c.fillText(kind === 'van' ? 'HELIX' : 'ORBITAL', 30, 76)
    c.fillStyle = kind === 'van' ? '#c23a2b' : '#1f5c8a'
    c.font = 'bold 22px sans-serif'
    c.fillText(kind === 'van' ? 'FACILITY SERVICES' : 'FREIGHT  •  24/7 LOGISTICS', 34, 102)
    c.fillStyle = 'rgba(30,30,30,0.6)'
    c.font = '16px monospace'
    c.fillText('UNIT 07-' + (kind === 'van' ? '3318' : '9042'), 380, 150)
  }, { roughness: 0.4, metalness: 0.2 })
}

/** A square high-voltage warning sign. */
export function dangerSign() {
  return drawn('dangerSign', 128, 128, (c) => warningSign(c, 0, 0, 128, 128, 'HIGH VOLTAGE'), { roughness: 0.5 })
}

/** Hazard stripes as a material, for edges and floor marks. */
export function hazardStripes() {
  return drawn('hazard', 256, 32, (c) => stripes(c, 0, 0, 256, 32, '#d9a91a', '#15130f', 16), { roughness: 0.6, repeatX: 2 })
}

// ---------- Stock: pallets, crates and stacked boxes ----------

/** A timber pallet 1.6 wide and 0.25 tall in one merged mesh: deck boards, blocks and bottom boards. */
export const PALLET = mergedBoxes('pallet', [
  ...[-0.48, -0.24, 0, 0.24, 0.48].map((z) => [-0.8, 0.21, 1.6, 0.04, 0.15, z] as const),
  ...[-0.75, -0.05, 0.65].map((x) => [x, 0.17, 0.1, 0.04, 1.1, 0] as const),
  ...[-0.76, -0.06, 0.64].flatMap((x) => [-0.48, 0, 0.48].map((z) => [x, 0.04, 0.12, 0.13, 0.14, z] as const)),
  ...[-0.48, 0, 0.48].map((z) => [-0.8, 0, 1.6, 0.04, 0.15, z] as const),
])
export const palletWood = () => photo('wood', 0x8e8a84, 0)

export function pallet(group: Group, x: number, z: number, width = 1.6): Mesh {
  const mesh = place(group, PALLET, palletWood())
  mesh.position.set(x, 0, z)
  mesh.scale.x = width / 1.6
  return mesh
}

/** The dark frame boards nailed round a crate face, for a unit crate (scaled per crate). */
const CRATE_FRAME = mergedBoxes('crateFrame', [
  [-0.5, 0, 1, 0.1, 1.02, 0], [-0.5, 0.9, 1, 0.1, 1.02, 0], [-0.5, 0.45, 1, 0.09, 1.02, 0],
  [-0.52, 0, 0.1, 1, 1.04, 0], [0.42, 0, 0.1, 1, 1.04, 0],
])

/** A timber crate standing on `bottom`, centred on x and z. */
export function crate(group: Group, x: number, bottom: number, w: number, h: number, depth: number, z: number, kind: 'pine' | 'olive'): void {
  box(group, crateFace(kind), x - w / 2, bottom, w, h, depth, z)
  const frame = place(group, CRATE_FRAME, photo('wood', kind === 'pine' ? 0x5c5246 : 0x3a4030, 0))
  frame.scale.set(w, h, depth)
  frame.position.set(x, bottom, z)
}

/** Boxes or bundles stacked into one merged block, `across` by `high`, as a single mesh; each shows the whole picture. */
export function stackedBlocks(group: Group, material: Material, x: number, bottom: number, w: number, h: number, depth: number, z: number, across: number, high: number): Mesh {
  const cells: [number, number, number, number, number, number][] = []
  for (let row = 0; row < high; row += 1) {
    for (let col = 0; col < across; col += 1) {
      const nudge = ((row * 3 + col * 5) % 4) * 0.012
      cells.push([-0.5 + col / across + nudge, row / high, 1 / across - 0.012, 1 / high - 0.006, 1 - nudge, 0])
    }
  }
  const mesh = place(group, mergedBoxes(`blocks:${across}:${high}`, cells), material)
  mesh.scale.set(w, h, depth)
  mesh.position.set(x, bottom, z)
  return mesh
}
