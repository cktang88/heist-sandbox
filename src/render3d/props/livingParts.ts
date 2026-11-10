import {
  CanvasTexture, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry,
  Quaternion, RepeatWrapping, SRGBColorSpace, TorusGeometry, Vector3, type BufferGeometry, type Material, type Texture,
} from 'three'
import { CYLINDER, glow, matte, scanned, type ScanOptions } from './kit'

/**
 * Parts shared by the living-quarters props: a muted palette, small painted textures (made once, on first use),
 * and helpers for things boxes alone do badly (flat printed fronts, rods lying down, rows of repeated items).
 */

export const PLANE = new PlaneGeometry(1, 1)
export const RING = new TorusGeometry(1, 0.12, 8, 24)
/** Six-sided so dumbbell heads and weight plates read as cast iron rather than tubes. */
export const HEX = new CylinderGeometry(1, 1, 1, 6)

// --- Palette: muted, slightly dirty versions of real finishes. ---
export const STEEL = matte(0x9aa1a8, 0.35, 0.5)
export const DARK_STEEL = matte(0x2b3036, 0.5, 0.6)
// Metals stay partly diffuse: rooms have little reflected light, and fully metallic parts would read as black.
export const CHROME = matte(0xd0d4d8, 0.25, 0.55)
export const BRASS = matte(0xb08a42, 0.3, 0.6)
export const BLACK_PLASTIC = matte(0x17191c, 0.45)
export const RUBBER = matte(0x101113, 0.92)
export const PORCELAIN = matte(0xe2e0d9, 0.22)
export const ENAMEL = matte(0xd4d2ca, 0.4)
export const WARM_WOOD = matte(0x6e4a30, 0.6)
export const DARK_WOOD = matte(0x3b281c, 0.5)
export const PALE_WOOD = matte(0x9a7a56, 0.65)
export const LEATHER_BLACK = matte(0x1a1817, 0.55)
export const LEATHER_RED = matte(0x6e1f1c, 0.5)
export const LINEN = matte(0xd9d4c6, 0.95)
export const MATTRESS = matte(0xa9a493, 0.95)
export const STRIPE_TICKING = matte(0x8e9aa6, 0.95)
export const IRON = matte(0x24272b, 0.55, 0.5)
export const INTERIOR_DARK = matte(0x0c0d0f, 0.9)
export const GLOSS_BLACK = matte(0x0b0b0c, 0.12, 0.1)
export const HOSPITAL_BLUE = matte(0x8fb3c4, 0.85)
export const PAPER = matte(0xe6e1d2, 0.9)
export const BLANKETS = [matte(0x4b5340, 0.95), matte(0x55585c, 0.95), matte(0x2d3646, 0.95), matte(0x6a3b31, 0.95)]
export const GLASS = new MeshStandardMaterial({ color: 0x9fb8c4, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false })
export const NET = new MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.9, transparent: true, opacity: 0.6, depthWrite: false })
export const FROSTED = new MeshStandardMaterial({ color: 0xcdd9de, roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false })
export const LED_RED = glow(0xff3b30, 4)
export const LED_GREEN = glow(0x5cff6a, 4)
export const LED_AMBER = glow(0xffb000, 3)
export const WARM_LAMP = glow(0xffc27a, 2.2)
export const COOL_LAMP = glow(0xdcecff, 2)

// --- Variety without randomness: each build takes the next number from a counter and scrambles it. ---
let builds = 0
/** A stable choice among `count` options; consecutive props of the same kind usually differ. */
export function pick(count: number): number {
  builds += 1
  return (Math.imul(builds, 2654435761) >>> 0) % 7919 % count
}

/** Small details do not need to cast shadows. */
export function noShadow<T extends Mesh>(mesh: T): T {
  mesh.castShadow = false
  return mesh
}

/** A flat printed face (screen, label, door front) facing the camera, by left edge, bottom edge, width and height. */
export function panel(group: Group, material: Material, left: number, bottom: number, w: number, h: number, z: number): Mesh {
  const mesh = new Mesh(PLANE, material)
  mesh.scale.set(w, h, 1)
  mesh.position.set(left + w / 2, bottom + h / 2, z)
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** A rod lying along x or z, centred on (x, y, z). */
export function rod(group: Group, material: Material, x: number, y: number, z: number, radius: number, length: number, axis: 'x' | 'z'): Mesh {
  const mesh = new Mesh(CYLINDER, material)
  mesh.scale.set(radius, length, radius)
  if (axis === 'x') mesh.rotation.z = Math.PI / 2
  else mesh.rotation.x = Math.PI / 2
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** Many copies of one shape in a single draw call. Each entry is [x, y, z, scaleX, scaleY, scaleZ, turnX?]. */
export function repeated(group: Group, geometry: BufferGeometry, material: Material, items: readonly (readonly number[])[]): InstancedMesh {
  const mesh = new InstancedMesh(geometry, material, items.length)
  const matrix = new Matrix4()
  const turn = new Quaternion()
  const axis = new Vector3(1, 0, 0)
  items.forEach(([x, y, z, sx, sy, sz, turnX = 0], index) => {
    turn.setFromAxisAngle(axis, turnX)
    mesh.setMatrixAt(index, matrix.compose(new Vector3(x, y, z), turn, new Vector3(sx, sy, sz)))
  })
  mesh.computeBoundingSphere()
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** A scanned model, optionally stretched unevenly (x, y, z) after the turn, for frames that need a different length or height. */
export function scan(group: Group, id: string, options: ScanOptions & { stretch?: readonly [number, number, number] } = {}): void {
  if (!scanned(group, id, options)) return
  const holder = group.children[group.children.length - 1]
  if (!options.stretch) return
  // The holder is turned about y, so wrap it to stretch along the group's axes rather than the model's.
  const outer = new Group()
  outer.position.copy(holder.position)
  holder.position.set(0, 0, 0)
  outer.scale.set(...options.stretch)
  group.remove(holder)
  outer.add(holder)
  group.add(outer)
}

/** A hinged part: children added to the returned group turn about a vertical line at (x, z). */
export function hinge(group: Group, x: number, z: number, angle: number): Group {
  const pivot = new Group()
  pivot.position.set(x, 0, z)
  pivot.rotation.y = angle
  group.add(pivot)
  return pivot
}

// --- Painted textures. Each is drawn once, the first time a prop needs it. ---
type Paint = (c: CanvasRenderingContext2D, w: number, h: number) => void
const textures = new Map<string, Texture>()
function painted(key: string, w: number, h: number, paint: Paint): Texture {
  const known = textures.get(key)
  if (known) return known
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  paint(canvas.getContext('2d')!, w, h)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  textures.set(key, texture)
  return texture
}

const surfaces = new Map<string, MeshStandardMaterial>()
/** A material with a painted face, cached by key. `light` makes it give off its own picture (screens, lit panels). */
export function printed(key: string, w: number, h: number, paint: Paint, options: { light?: number; roughness?: number; metalness?: number; tint?: number; alpha?: boolean } = {}): MeshStandardMaterial {
  const id = `${key}:${options.light ?? 0}:${options.tint ?? 0xffffff}`
  const known = surfaces.get(id)
  if (known) return known
  const map = painted(key, w, h, paint)
  const material = new MeshStandardMaterial({
    map, color: options.tint ?? 0xffffff, roughness: options.roughness ?? 0.7, metalness: options.metalness ?? 0,
    ...(options.light ? { emissive: 0xffffff, emissiveMap: map, emissiveIntensity: options.light } : {}),
    ...(options.alpha ? { transparent: false, alphaTest: 0.5, side: DoubleSide } : {}),
  })
  surfaces.set(id, material)
  return material
}

/** The same painted image repeated across a face, e.g. a row of locker doors. */
export function repeatedPrint(key: string, base: MeshStandardMaterial, across: number): MeshStandardMaterial {
  const id = `${key}:x${across}:${base.color.getHex()}`
  const known = surfaces.get(id)
  if (known) return known
  const map = base.map!.clone()
  map.wrapS = RepeatWrapping
  map.repeat.set(across, 1)
  map.needsUpdate = true
  const material = base.clone()
  material.map = map
  surfaces.set(id, material)
  return material
}

/** Deterministic speckle for grime, so painted faces are not flat. */
export function grime(c: CanvasRenderingContext2D, w: number, h: number, count: number, alpha: number): void {
  let seed = 7
  const next = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (let i = 0; i < count; i++) {
    c.fillStyle = `rgba(30,24,18,${alpha * next()})`
    const size = 1 + next() * 4
    c.fillRect(next() * w, next() * h, size, size * (0.5 + next()))
  }
}

// --- The painted faces themselves. ---

/** A run of pale steel locker doors: louvres top and bottom, a latch handle and a number card each. Tinted per locker. */
export function lockerDoors(doors: number, tint: number): MeshStandardMaterial {
  return printed(`lockers${doors}`, 64 * doors, 256, (c, w, h) => {
    c.fillStyle = '#d8d8d4'
    c.fillRect(0, 0, w, h)
    for (let door = 0; door < doors; door++) {
      const left = door * 64
      c.fillStyle = '#8a8a86'
      c.fillRect(left, 0, 3, h)
      c.fillRect(left + 61, 0, 3, h)
      for (const top of [14, 200]) for (let i = 0; i < 6; i++) {
        c.fillStyle = '#2a2a2a'
        c.fillRect(left + 14, top + i * 7, 36, 3)
        c.fillStyle = '#f2f2ee'
        c.fillRect(left + 14, top + i * 7 + 3, 36, 1)
      }
      c.fillStyle = '#efe9d8'
      c.fillRect(left + 22, 64, 22, 12)
      c.fillStyle = '#333'
      c.font = 'bold 9px monospace'
      c.fillText(String(21 + door * 3 + doors), left + 26, 74)
      c.fillStyle = '#4a4a48'
      c.fillRect(left + 46, 112, 8, 34)
      c.fillStyle = '#bdbdb8'
      c.fillRect(left + 47, 114, 6, 12)
    }
    grime(c, w, h, 50 * doors, 0.12)
    const scuff = c.createLinearGradient(0, h - 40, 0, h)
    scuff.addColorStop(0, 'rgba(60,40,20,0)')
    scuff.addColorStop(1, 'rgba(60,40,20,0.4)')
    c.fillStyle = scuff
    c.fillRect(0, h - 40, w, 40)
  }, { roughness: 0.55, metalness: 0.25, tint })
}

/** The glass front of a drinks machine: lit rows of cans and bottles, price tags and a brand header. */
export function vendingFront(brand: 0 | 1): MeshStandardMaterial {
  const scheme = brand === 0
    ? { head: '#c8202a', text: 'NEO COLA', textColour: '#fff3e0', glow: '#bcc8d2' }
    : { head: '#1d4f9a', text: 'SNAX 24/7', textColour: '#ffe36b', glow: '#d2c8b4' }
  return printed(`vending${brand}`, 128, 256, (c, w, h) => {
    c.fillStyle = scheme.head
    c.fillRect(0, 0, w, 40)
    c.fillStyle = scheme.textColour
    c.font = 'bold 19px sans-serif'
    c.textAlign = 'center'
    c.fillText(scheme.text, w / 2 - 8, 27)
    c.fillStyle = '#0d0f12'
    c.fillRect(0, 40, w, h - 40)
    c.fillStyle = scheme.glow
    c.fillRect(6, 46, 92, 168)
    const colours = ['#c8202a', '#e8e3d6', '#2a6fd0', '#f0b21f', '#2f9a4a', '#d0402a', '#8a2bd0', '#e86a1c']
    for (let row = 0; row < 6; row++) {
      c.fillStyle = '#7a7f86'
      c.fillRect(6, 72 + row * 28, 92, 3)
      for (let col = 0; col < 6; col++) {
        const colour = colours[(row * 3 + col * (brand ? 2 : 5)) % colours.length]
        const tall = brand === 0 ? 22 : 15
        c.fillStyle = colour
        c.fillRect(9 + col * 15, 72 + row * 28 - tall, 11, tall)
        c.fillStyle = 'rgba(255,255,255,0.45)'
        c.fillRect(10 + col * 15, 72 + row * 28 - tall + 1, 2, tall - 2)
        c.fillStyle = '#20242a'
        c.fillRect(11 + col * 15, 76 + row * 28, 7, 4)
      }
    }
    // Keypad and coin slot to the right of the glass.
    c.fillStyle = '#1a1d22'
    c.fillRect(102, 46, 22, 168)
    c.fillStyle = '#39ff8a'
    c.fillRect(105, 52, 16, 8)
    c.fillStyle = '#b8bcc2'
    for (let i = 0; i < 12; i++) c.fillRect(105 + (i % 3) * 6, 70 + Math.floor(i / 3) * 7, 4, 4)
    c.fillStyle = '#ffb000'
    c.fillRect(110, 112, 6, 14)
    c.fillStyle = '#050505'
    c.fillRect(10, 222, 84, 26)
    c.fillStyle = '#2a2d33'
    c.fillRect(12, 224, 80, 4)
    // Reflection streak across the glass.
    c.fillStyle = 'rgba(255,255,255,0.10)'
    c.beginPath()
    c.moveTo(20, 46)
    c.lineTo(50, 46)
    c.lineTo(20, 140)
    c.lineTo(6, 140)
    c.fill()
  }, { light: 1.3, roughness: 0.25 })
}

/** A glass-door drinks cooler: shelves of bottles under cold light. */
export function coolerFront(): MeshStandardMaterial {
  return printed('cooler', 64, 160, (c, w, h) => {
    c.fillStyle = '#dfeefa'
    c.fillRect(0, 0, w, h)
    const colours = ['#3a7a3a', '#7a4a1a', '#c8202a', '#d8c070', '#2a5aa0', '#e8e8e8']
    for (let row = 0; row < 5; row++) {
      const base = 30 + row * 30
      c.fillStyle = '#8b96a0'
      c.fillRect(0, base, w, 2)
      for (let col = 0; col < 7; col++) {
        c.fillStyle = colours[(row * 2 + col) % colours.length]
        c.fillRect(3 + col * 9, base - 20, 6, 20)
        c.fillRect(5 + col * 9, base - 26, 2, 6)
      }
    }
    c.fillStyle = 'rgba(0,0,0,0.25)'
    c.fillRect(0, 0, w, 4)
  }, { light: 1.1, roughness: 0.2 })
}

/** The playfield of an arcade game: a starfield shooter, in big chunky pixels. */
export function arcadeScreen(): MeshStandardMaterial {
  return printed('arcadeScreen', 64, 80, (c, w, h) => {
    c.fillStyle = '#05030c'
    c.fillRect(0, 0, w, h)
    let seed = 3
    const next = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 40; i++) {
      c.fillStyle = next() > 0.7 ? '#8fd0ff' : '#c8c8ff'
      c.fillRect(Math.floor(next() * w), Math.floor(next() * h), 1, 1)
    }
    const invaders = ['#ff2d95', '#7cff4f', '#00e5ff']
    for (let row = 0; row < 3; row++) for (let col = 0; col < 6; col++) {
      c.fillStyle = invaders[row]
      c.fillRect(6 + col * 9, 10 + row * 9, 6, 4)
      c.fillRect(7 + col * 9, 14 + row * 9, 1, 2)
      c.fillRect(10 + col * 9, 14 + row * 9, 1, 2)
    }
    c.fillStyle = '#ffe14a'
    c.fillRect(30, 66, 6, 4)
    c.fillRect(32, 63, 2, 3)
    c.fillRect(33, 46, 1, 6)
    c.fillStyle = '#ffffff'
    c.font = '6px monospace'
    c.fillText('1UP 004210', 2, 6)
  }, { light: 1.8, roughness: 0.15 })
}

/** The lit marquee above an arcade screen. */
export function arcadeMarquee(): MeshStandardMaterial {
  return printed('arcadeMarquee', 128, 32, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#2a0b4a')
    sky.addColorStop(1, '#ff2d95')
    c.fillStyle = sky
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#ffe14a'
    c.font = 'bold italic 17px sans-serif'
    c.textAlign = 'center'
    c.fillText('STAR RAID', w / 2, 23)
    c.strokeStyle = '#00e5ff'
    c.lineWidth = 1
    c.strokeText('STAR RAID', w / 2, 23)
  }, { light: 1.6 })
}

/** A television picture: a news studio or a match. */
export function tvPicture(channel: 0 | 1): MeshStandardMaterial {
  return printed(`tv${channel}`, 128, 72, (c, w, h) => {
    if (channel === 0) {
      const back = c.createLinearGradient(0, 0, w, h)
      back.addColorStop(0, '#0d2a5a')
      back.addColorStop(1, '#1d5a9a')
      c.fillStyle = back
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#c8d8f0'
      c.fillRect(78, 10, 40, 26)
      c.fillStyle = '#3a2a22'
      c.beginPath()
      c.arc(46, 30, 9, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#20232a'
      c.fillRect(30, 40, 32, 22)
      c.fillStyle = '#c8202a'
      c.fillRect(0, 56, w, 9)
      c.fillStyle = '#ffffff'
      c.font = 'bold 7px sans-serif'
      c.fillText('BREAKING  CORPORATE TOWER ON LOCKDOWN', 3, 63)
    } else {
      c.fillStyle = '#2f7a3a'
      c.fillRect(0, 0, w, h)
      c.fillStyle = '#3a8a44'
      for (let x = 0; x < w; x += 16) c.fillRect(x, 0, 8, h)
      c.strokeStyle = '#e8f0e8'
      c.lineWidth = 1
      c.strokeRect(6, 6, w - 12, h - 12)
      c.beginPath()
      c.moveTo(w / 2, 6)
      c.lineTo(w / 2, h - 6)
      c.stroke()
      c.fillStyle = '#e8e030'
      for (const [x, y] of [[30, 30], [52, 44], [88, 26], [70, 50]]) c.fillRect(x, y, 3, 5)
      c.fillStyle = '#d02a2a'
      for (const [x, y] of [[40, 20], [80, 40], [96, 54]]) c.fillRect(x, y, 3, 5)
      c.fillStyle = 'rgba(0,0,0,0.6)'
      c.fillRect(4, 4, 44, 9)
      c.fillStyle = '#fff'
      c.font = 'bold 7px sans-serif'
      c.fillText('NCU 2 - 1 KTO', 6, 11)
    }
  }, { light: 1.5, roughness: 0.2 })
}

/** Square white wall tiles with grey grout and some grime toward the bottom. */
export function wallTiles(): MeshStandardMaterial {
  return printed('tiles', 128, 256, (c, w, h) => {
    c.fillStyle = '#8c8c86'
    c.fillRect(0, 0, w, h)
    const size = 21.33
    for (let y = 0; y < 12; y++) for (let x = 0; x < 6; x++) {
      const shade = 222 + ((x * 7 + y * 13) % 9) - 4
      c.fillStyle = `rgb(${shade},${shade},${shade - 4})`
      c.fillRect(x * size + 1, y * size + 1, size - 2, size - 2)
    }
    const dirt = c.createLinearGradient(0, h * 0.6, 0, h)
    dirt.addColorStop(0, 'rgba(90,80,60,0)')
    dirt.addColorStop(1, 'rgba(90,80,60,0.35)')
    c.fillStyle = dirt
    c.fillRect(0, 0, w, h)
    grime(c, w, h, 120, 0.2)
  }, { roughness: 0.25 })
}

/** Small brick-laid splashback tiles, for kitchens and bars. */
export function subwayTiles(): MeshStandardMaterial {
  return printed('subway', 256, 64, (c, w, h) => {
    c.fillStyle = '#7d7a72'
    c.fillRect(0, 0, w, h)
    for (let row = 0; row < 8; row++) for (let col = -1; col < 17; col++) {
      const shade = 210 + ((row * 5 + col * 11) % 12)
      c.fillStyle = `rgb(${shade},${shade - 2},${shade - 10})`
      c.fillRect(col * 16 + (row % 2) * 8 + 1, row * 8 + 1, 14, 6)
    }
    grime(c, w, h, 90, 0.18)
  }, { roughness: 0.3 })
}

/** A run of cupboard doors and drawers with bar handles. Pale so a tint picks the paint colour. */
export function cupboardFronts(tint: number): MeshStandardMaterial {
  return printed('cupboards', 256, 96, (c, w, h) => {
    c.fillStyle = '#d6d4cf'
    c.fillRect(0, 0, w, h)
    for (let door = 0; door < 4; door++) {
      const left = door * 64
      c.fillStyle = '#5a5955'
      c.fillRect(left, 0, 2, h)
      c.fillRect(left, 24, 64, 2)
      c.fillStyle = '#e4e2dd'
      c.fillRect(left + 4, 3, 56, 18)
      c.fillRect(left + 4, 29, 56, h - 33)
      c.fillStyle = '#8a8c90'
      c.fillRect(left + 22, 10, 20, 3)
      c.fillRect(door % 2 ? left + 8 : left + 52, 36, 3, 22)
    }
    grime(c, w, h, 70, 0.1)
  }, { roughness: 0.55, tint })
}

/** Shelves of medicine bottles and boxes behind a glass cabinet door. */
export function medicineShelves(): MeshStandardMaterial {
  return printed('meds', 64, 96, (c, w, h) => {
    c.fillStyle = '#e6eef0'
    c.fillRect(0, 0, w, h)
    const items = ['#7a4a1a', '#f0f0f0', '#2a6fd0', '#f0f0f0', '#c8202a', '#e8c040', '#7a4a1a', '#f0f0f0']
    for (let row = 0; row < 4; row++) {
      const base = 22 + row * 23
      c.fillStyle = '#9aa4a8'
      c.fillRect(0, base, w, 2)
      let x = 3
      for (let i = 0; x < w - 6; i++) {
        const wide = 4 + ((i * 7 + row * 3) % 6)
        const tall = 8 + ((i * 5 + row) % 9)
        c.fillStyle = items[(i + row * 3) % items.length]
        c.fillRect(x, base - tall, wide, tall)
        x += wide + 2
      }
    }
    c.fillStyle = 'rgba(255,255,255,0.25)'
    c.fillRect(8, 0, 6, h)
  }, { roughness: 0.15, light: 0.25 })
}

/** One fold-out panel of a ward privacy screen: tube frame, pleated fabric, legs. Holes are cut out. */
export function screenPanel(): MeshStandardMaterial {
  return printed('screenPanel', 64, 160, (c, w, h) => {
    c.clearRect(0, 0, w, h)
    for (let x = 4; x < w - 4; x++) {
      const fold = 0.82 + 0.18 * Math.sin(x * 0.55)
      c.fillStyle = `rgb(${Math.round(176 * fold)},${Math.round(204 * fold)},${Math.round(198 * fold)})`
      c.fillRect(x, 8, 1, 128)
    }
    c.fillStyle = 'rgba(90,80,60,0.2)'
    c.fillRect(4, 118, w - 8, 18)
    c.fillStyle = '#c9ced3'
    c.fillRect(0, 2, 4, 150)
    c.fillRect(w - 4, 2, 4, 150)
    c.fillRect(0, 2, w, 4)
    c.fillRect(0, 134, w, 4)
    c.fillStyle = '#202224'
    c.fillRect(0, 150, 6, 10)
    c.fillRect(w - 6, 150, 6, 10)
  }, { roughness: 0.85, alpha: true })
}

/** Flames over glowing embers, for a fireplace opening. */
export function flames(): MeshStandardMaterial {
  return printed('flames', 128, 64, (c, w, h) => {
    c.fillStyle = '#000000'
    c.fillRect(0, 0, w, h)
    const embers = c.createLinearGradient(0, h - 14, 0, h)
    embers.addColorStop(0, '#ff6a10')
    embers.addColorStop(1, '#5a1000')
    c.fillStyle = embers
    c.fillRect(8, h - 14, w - 16, 14)
    for (let i = 0; i < 9; i++) {
      const x = 14 + i * 12.5
      const tall = 22 + ((i * 17) % 23)
      const flame = c.createLinearGradient(0, h - 10 - tall, 0, h - 8)
      flame.addColorStop(0, 'rgba(255,200,80,0)')
      flame.addColorStop(0.35, '#ffb030')
      flame.addColorStop(1, '#ff5a00')
      c.fillStyle = flame
      c.beginPath()
      c.moveTo(x - 7, h - 8)
      c.quadraticCurveTo(x - 6, h - 10 - tall * 0.5, x + ((i % 3) - 1) * 3, h - 10 - tall)
      c.quadraticCurveTo(x + 6, h - 10 - tall * 0.5, x + 7, h - 8)
      c.fill()
    }
  }, { light: 2.6 })
}

/** A mirror's surface: a dim, soft reflection of a lit room with a bright streak. */
export function mirrorGlass(): MeshStandardMaterial {
  return printed('mirror', 64, 64, (c, w, h) => {
    const back = c.createLinearGradient(0, 0, w, h)
    back.addColorStop(0, '#9aa6ae')
    back.addColorStop(0.5, '#5d666d')
    back.addColorStop(1, '#3c4247')
    c.fillStyle = back
    c.fillRect(0, 0, w, h)
    c.fillStyle = 'rgba(255,255,255,0.28)'
    c.beginPath()
    c.moveTo(10, 0)
    c.lineTo(24, 0)
    c.lineTo(6, h)
    c.lineTo(-8, h)
    c.fill()
    c.fillStyle = 'rgba(255,255,255,0.14)'
    c.beginPath()
    c.moveTo(30, 0)
    c.lineTo(34, 0)
    c.lineTo(16, h)
    c.lineTo(12, h)
    c.fill()
    // Silvering going dark at the edges, as old mirrors do.
    c.strokeStyle = 'rgba(30,26,20,0.5)'
    c.lineWidth = 3
    c.strokeRect(1, 1, w - 2, h - 2)
  }, { roughness: 0.05, metalness: 0.3, light: 0.35 })
}

/** A stencilled label for a footlocker. Pale so a tint picks the paint colour. */
export function stencil(tint: number): MeshStandardMaterial {
  return printed('stencil', 128, 48, (c, w, h) => {
    c.fillStyle = '#c8c8c0'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#ffffff'
    c.font = 'bold 16px monospace'
    c.textAlign = 'center'
    c.fillText('SEC 7734', w / 2, 28)
    c.font = '9px monospace'
    c.fillText('PROPERTY OF KTO', w / 2, 41)
    grime(c, w, h, 160, 0.3)
  }, { roughness: 0.8, tint })
}

/** The front of a coffee vending machine: cup picture, menu buttons, a small display. */
export function coffeeFront(): MeshStandardMaterial {
  return printed('coffee', 64, 128, (c, w, h) => {
    const back = c.createLinearGradient(0, 0, 0, h)
    back.addColorStop(0, '#3a1e12')
    back.addColorStop(1, '#120a06')
    c.fillStyle = back
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#f0e6d8'
    c.fillRect(10, 14, 22, 20)
    c.fillStyle = '#6a3a1a'
    c.fillRect(12, 16, 18, 5)
    c.fillStyle = 'rgba(240,230,216,0.5)'
    c.fillRect(16, 6, 2, 7)
    c.fillRect(22, 4, 2, 8)
    c.fillStyle = '#ffd9a0'
    c.font = 'bold 9px sans-serif'
    c.fillText('HOT', 36, 22)
    c.fillText('BREW', 34, 32)
    for (let i = 0; i < 6; i++) {
      c.fillStyle = '#2a1a10'
      c.fillRect(8, 44 + i * 9, 48, 7)
      c.fillStyle = i === 2 ? '#7cff4f' : '#ffb000'
      c.fillRect(50, 46 + i * 9, 4, 3)
      c.fillStyle = '#d8c8b0'
      c.fillRect(10, 47 + i * 9, 20 + ((i * 7) % 12), 1)
    }
    c.fillStyle = '#1a3a2a'
    c.fillRect(8, 104, 30, 9)
    c.fillStyle = '#7cff9f'
    c.font = '7px monospace'
    c.fillText('0.80', 12, 111)
  }, { light: 1.2, roughness: 0.3 })
}

/** Plastic trays slotted into a trolley, seen edge-on. Gaps between them are cut out. */
export function trayEdges(): MeshStandardMaterial {
  return printed('trays', 32, 128, (c, w) => {
    const colours = ['#a5521e', '#6a5a4a', '#a5521e', '#3a5a6a', '#a5521e', '#6a5a4a', '#a5521e', '#a5521e', '#3a5a6a', '#6a5a4a']
    colours.forEach((colour, i) => {
      c.fillStyle = colour
      c.fillRect(0, 8 + i * 12, w, 4)
    })
  }, { roughness: 0.5, alpha: true })
}
