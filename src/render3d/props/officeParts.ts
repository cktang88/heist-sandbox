import {
  CanvasTexture, DoubleSide, Group, Mesh, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, type Material,
} from 'three'
import { BOX, box, cylinder, glow, matte } from './kit'

/**
 * Shared pieces for the office and decor prop models: variant picking, canvas textures made once,
 * textured materials, and small reusable sub-assemblies (monitor, keyboard, mug, office chair).
 */

const counters = new Map<string, number>()
let salt = 0

/**
 * Makes the variants picked from now on depend only on `seed` (a prop's id), not on how many props were built
 * before: props are built region by region as the camera nears them, in no fixed order.
 */
export function pickFor(seed: number): void {
  counters.clear()
  salt = Math.imul(seed + 1, 0x9e3779b1) >>> 0
}

/** Picks one of `count` variants for a kind. Deterministic: the same prop always gets the same one. */
export function pick(kind: string, count: number): number {
  const n = counters.get(kind) ?? 0
  counters.set(kind, n + 1)
  let hash = salt
  for (let i = 0; i < kind.length; i += 1) hash = Math.imul(hash ^ kind.charCodeAt(i), 16777619) >>> 0
  return (Math.imul(n + 7 + hash, 2654435761) >>> 16) % count
}

/** A small seeded generator so painted textures look hand-made but come out the same every run. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Runs `make` the first time it is asked for, then hands back the same result. */
export function lazy<T>(make: () => T): () => T {
  let made: T | undefined
  return () => (made ??= make())
}

/** Paints a canvas once and wraps it as a colour texture. */
export function paint(width: number, height: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d')!, width, height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * A printed or painted surface (poster, rug, board). `alpha`: 'cutout' gives hard see-through edges (torn paper,
 * leaves), 'blend' soft ones (stains, spray paint), which are drawn over the wall without writing depth.
 */
export function printed(texture: CanvasTexture, roughness = 0.85, alpha: 'none' | 'cutout' | 'blend' = 'none'): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map: texture, roughness, side: alpha === 'cutout' ? DoubleSide : undefined,
    alphaTest: alpha === 'cutout' ? 0.5 : 0, transparent: alpha === 'blend', depthWrite: alpha !== 'blend',
    polygonOffset: alpha === 'blend', polygonOffsetFactor: -2,
  })
}

/** A lit image (screens, signs). Strength above about 1.4 blooms. */
export function lit(texture: CanvasTexture, strength: number, cutout = false): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color: 0x000000, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: strength, roughness: 0.3,
    // With a cutout the colour map only carries the image's alpha; its colour is multiplied by black.
    map: cutout ? texture : null, transparent: cutout, depthWrite: !cutout,
  })
}

export const PLANE = new PlaneGeometry(1, 1)
/** Adds a flat picture facing the camera (+z) by its left edge, bottom edge, width and height. */
export function plane(group: Group, material: Material, left: number, bottom: number, w: number, h: number, z: number): Mesh {
  const mesh = new Mesh(PLANE, material)
  mesh.scale.set(w, h, 1)
  mesh.position.set(left + w / 2, bottom + h / 2, z)
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** A box that is too small to throw a useful shadow. */
export function bit(group: Group, material: Material, left: number, bottom: number, w: number, h: number, depth: number, z = 0): Mesh {
  const mesh = box(group, material, left, bottom, w, h, depth, z)
  mesh.castShadow = false
  return mesh
}

/** A cylinder lying along x (pipes, rails, rods). */
export function rod(group: Group, material: Material, left: number, y: number, length: number, radius: number, z: number): Mesh {
  const mesh = cylinder(group, material, 0, 0, radius, length, z)
  mesh.rotation.z = Math.PI / 2
  mesh.position.set(left + length / 2, y, z)
  return mesh
}

/** A cylinder lying along z (knobs, dials, lenses pointing at the camera). */
export function knob(group: Group, material: Material, x: number, y: number, radius: number, depth: number, z: number): Mesh {
  const mesh = cylinder(group, material, x, 0, radius, depth, z)
  mesh.rotation.x = Math.PI / 2
  mesh.position.set(x, y, z)
  mesh.castShadow = false
  return mesh
}

// ---------- shared colours (cached by the kit, so every prop reuses the same materials) ----------

export const C = {
  black: () => matte(0x15171a, 0.45),
  plastic: () => matte(0x24272c, 0.5),
  offWhite: () => matte(0xc9c5bb, 0.55),
  steel: () => matte(0x7a8189, 0.42, 0.65),
  darkSteel: () => matte(0x30353c, 0.5, 0.6),
  alu: () => matte(0xa7abaf, 0.32, 0.85),
  chrome: () => matte(0xc8ccd0, 0.18, 1),
  brass: () => matte(0xb08a3e, 0.3, 0.9),
  walnut: () => matte(0x4a3326, 0.55),
  oak: () => matte(0x8a6a4a, 0.6),
  greyLaminate: () => matte(0x6f716e, 0.6),
  leather: () => matte(0x1e1a18, 0.5),
  tan: () => matte(0x6b4630, 0.55),
  fabricBlue: () => matte(0x34404e, 0.95),
  fabricGrey: () => matte(0x4a4c50, 0.95),
  fabricRust: () => matte(0x6a3a2a, 0.95),
  paper: () => matte(0xe6e2d6, 0.9),
  paperOld: () => matte(0xcfc6ad, 0.9),
  cardboard: () => matte(0x9a7a52, 0.95),
  leaf: () => matte(0x3a5a30, 0.7),
  leafDark: () => matte(0x2a4626, 0.7),
  leafLight: () => matte(0x5a7a40, 0.7),
  soil: () => matte(0x2a2018, 1),
  terracotta: () => matte(0x8a4b2d, 0.9),
  concretePot: () => matte(0x6b6f73, 0.95),
  gold: () => matte(0xd8a63c, 0.25, 1),
  silver: () => matte(0xb8bcc2, 0.25, 1),
  ledGreen: () => glow(0x39ff6a, 4),
  ledRed: () => glow(0xff3b30, 4),
  ledAmber: () => glow(0xffb000, 4),
  ledBlue: () => glow(0x3ab8ff, 3),
}

// ---------- screen images ----------

function screenCode(): CanvasTexture {
  return paint(256, 160, (c, w, h) => {
    const r = seeded(11)
    c.fillStyle = '#0d1117'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#161b22'
    c.fillRect(0, 0, 44, h)
    const colours = ['#7ee787', '#79c0ff', '#ff7b72', '#d2a8ff', '#c9d1d9', '#c9d1d9']
    for (let line = 0; line < 17; line += 1) {
      let x = 50 + Math.floor(r() * 4) * 10
      const words = 1 + Math.floor(r() * 5)
      for (let word = 0; word < words; word += 1) {
        const len = 10 + r() * 40
        c.fillStyle = colours[Math.floor(r() * colours.length)]
        c.fillRect(x, 6 + line * 9, len, 4)
        x += len + 6
      }
    }
    c.fillStyle = '#30363d'
    for (let line = 0; line < 17; line += 1) c.fillRect(8, 6 + line * 9, 22, 4)
  })
}

function screenSheet(): CanvasTexture {
  return paint(256, 160, (c, w, h) => {
    const r = seeded(23)
    c.fillStyle = '#e9ecef'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#1f6f43'
    c.fillRect(0, 0, w, 14)
    c.strokeStyle = '#b9c0c7'
    c.lineWidth = 1
    for (let y = 22; y < h; y += 9) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke() }
    for (let x = 30; x < w; x += 38) { c.beginPath(); c.moveTo(x, 14); c.lineTo(x, h); c.stroke() }
    c.fillStyle = '#444b52'
    for (let y = 24; y < h - 4; y += 9) for (let x = 34; x < w - 20; x += 38) if (r() > 0.25) c.fillRect(x, y, 8 + r() * 22, 4)
    c.fillStyle = '#3b7dd8'
    for (let bar = 0; bar < 6; bar += 1) c.fillRect(170 + bar * 12, 150 - 30 * r() - 10, 8, 40)
  })
}

function screenCctv(): CanvasTexture {
  return paint(256, 160, (c, w, h) => {
    const r = seeded(37)
    c.fillStyle = '#05070a'
    c.fillRect(0, 0, w, h)
    for (let cell = 0; cell < 4; cell += 1) {
      const x = (cell % 2) * 128 + 2
      const y = Math.floor(cell / 2) * 80 + 2
      const g = c.createLinearGradient(x, y, x, y + 76)
      g.addColorStop(0, '#2e3a36')
      g.addColorStop(1, '#141a18')
      c.fillStyle = g
      c.fillRect(x, y, 124, 76)
      // A corridor in perspective, a doorway and a figure or two, in washed-out greys.
      c.strokeStyle = '#56645e'
      c.beginPath()
      c.moveTo(x, y + 76); c.lineTo(x + 50, y + 34); c.lineTo(x + 74, y + 34); c.lineTo(x + 124, y + 76)
      c.stroke()
      c.fillStyle = '#6b7a72'
      c.fillRect(x + 54, y + 18, 16, 16)
      if (r() > 0.4) { c.fillStyle = '#1a1f1d'; c.fillRect(x + 30 + r() * 60, y + 40, 7, 22) }
      for (let n = 0; n < 160; n += 1) { c.fillStyle = `rgba(200,220,210,${r() * 0.12})`; c.fillRect(x + r() * 124, y + r() * 76, 2, 1) }
      c.fillStyle = '#d8e0dc'
      c.font = '8px monospace'
      c.fillText(`CAM 0${cell + 1}  02:4${cell}:1${cell}`, x + 4, y + 10)
      c.fillStyle = '#ff3b30'
      c.beginPath(); c.arc(x + 116, y + 7, 3, 0, Math.PI * 2); c.fill()
    }
  })
}

function screenDashboard(): CanvasTexture {
  return paint(384, 224, (c, w, h) => {
    const r = seeded(41)
    c.fillStyle = '#0b1220'
    c.fillRect(0, 0, w, h)
    c.fillStyle = '#19e3ff'
    c.font = 'bold 16px sans-serif'
    c.fillText('Q3 OPERATIONS  //  LIVE', 14, 24)
    c.strokeStyle = '#19e3ff'
    c.lineWidth = 2
    c.beginPath()
    let y = 150
    for (let x = 14; x < 240; x += 8) { y = Math.max(60, Math.min(190, y + (r() - 0.55) * 26)); c.lineTo(x, y) }
    c.stroke()
    c.fillStyle = 'rgba(25,227,255,0.12)'
    c.lineTo(234, 200); c.lineTo(14, 200); c.fill()
    for (let bar = 0; bar < 7; bar += 1) {
      const bh = 30 + r() * 100
      c.fillStyle = bar === 4 ? '#ff2d95' : '#ffb000'
      c.fillRect(262 + bar * 16, 200 - bh, 10, bh)
    }
    c.fillStyle = '#7cff4f'
    c.font = 'bold 26px sans-serif'
    c.fillText('+12.4%', 262, 56)
    c.fillStyle = '#8b98ad'
    c.font = '10px sans-serif'
    for (let row = 0; row < 3; row += 1) c.fillText(`SECTOR ${row + 7}   ${(r() * 900).toFixed(0)} u`, 262, 76 + row * 14)
  })
}

function screenNews(): CanvasTexture {
  return paint(384, 224, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, h)
    g.addColorStop(0, '#3a2a5a')
    g.addColorStop(1, '#0e1a33')
    c.fillStyle = g
    c.fillRect(0, 0, w, h)
    // Anchor silhouette against a skyline.
    c.fillStyle = '#1b1530'
    for (let x = 0; x < w; x += 22) c.fillRect(x, 60 + ((x * 37) % 70), 18, 200)
    c.fillStyle = '#2b2a3a'
    c.beginPath(); c.arc(120, 112, 30, 0, Math.PI * 2); c.fill()
    c.fillRect(70, 140, 100, 90)
    c.fillStyle = '#c8102e'
    c.fillRect(0, 172, w, 26)
    c.fillStyle = '#ffffff'
    c.font = 'bold 15px sans-serif'
    c.fillText('BREAKING: MARKETS SLIDE AS DISTRICT 9 BLACKOUT ENTERS DAY 3', 8, 190)
    c.fillStyle = '#111'
    c.fillRect(0, 198, w, 26)
    c.fillStyle = '#ffb000'
    c.font = '12px sans-serif'
    c.fillText('NKX 4,112 ▼  ARASAKA-ish 88.1 ▲  ORBITAL 12.7 ▼  RAIN 92%', 8, 215)
  })
}

const SCREENS = [screenCode, screenSheet, screenCctv, screenDashboard, screenNews].map((make) => lazy(() => lit(make(), 1.6)))
export type ScreenImage = 'code' | 'sheet' | 'cctv' | 'dashboard' | 'news'
const SCREEN_INDEX: Record<ScreenImage, number> = { code: 0, sheet: 1, cctv: 2, dashboard: 3, news: 4 }
export function screenMaterial(image: ScreenImage): MeshStandardMaterial {
  return SCREENS[SCREEN_INDEX[image]]()
}

// ---------- sub-assemblies ----------

/** A flat monitor on a stand, its base on `bottom`, centred at x and depth z. 4 meshes. */
export function monitor(group: Group, x: number, bottom: number, z: number, image: ScreenImage, w = 0.62, h = 0.38): void {
  box(group, C.black(), x - 0.12, bottom, 0.24, 0.02, 0.16, z)
  bit(group, C.plastic(), x - 0.025, bottom, 0.05, 0.3, 0.04, z - 0.03)
  box(group, C.black(), x - w / 2, bottom + 0.22, w, h, 0.035, z)
  plane(group, screenMaterial(image), x - w / 2 + 0.015, bottom + 0.235, w - 0.03, h - 0.03, z + 0.019)
}

/** Keyboard and mouse lying on a desk top at height y. 2 meshes. */
export function keyboard(group: Group, x: number, y: number, z: number): void {
  bit(group, C.plastic(), x - 0.22, y, 0.44, 0.02, 0.14, z)
  bit(group, C.plastic(), x + 0.3, y, 0.05, 0.025, 0.08, z)
}

/** A mug of coffee. 1 mesh. */
export function mug(group: Group, x: number, y: number, z: number, colour = 0xd8d2c4): void {
  const mesh = cylinder(group, matte(colour, 0.4), x, y, 0.035, 0.09, z)
  mesh.castShadow = false
}

/** A small untidy pile of paper on a desk. 2 meshes. */
export function papers(group: Group, x: number, y: number, z: number): void {
  const a = bit(group, C.paper(), x - 0.13, y, 0.26, 0.03, 0.2, z)
  a.rotation.y = 0.12
  const b = bit(group, C.paperOld(), x - 0.1, y + 0.03, 0.22, 0.012, 0.18, z + 0.02)
  b.rotation.y = -0.2
}

/** Drawer fronts with pull handles on a pedestal face at depth z. 2 meshes per drawer. */
export function drawers(group: Group, front: Material, left: number, bottom: number, w: number, h: number, count: number, z: number): void {
  const step = h / count
  for (let index = 0; index < count; index += 1) {
    bit(group, front, left + 0.02, bottom + index * step + 0.015, w - 0.04, step - 0.03, 0.02, z)
    bit(group, C.alu(), left + w / 2 - 0.08, bottom + (index + 0.7) * step, 0.16, 0.02, 0.03, z + 0.02)
  }
}

/** An office task chair: five-spoke base, gas column, seat, back and arms. `seat` is the fabric. 7 meshes. */
export function officeChair(group: Group, x: number, z: number, seat: Material, backTop = 1.15, turn = 0): void {
  const chair = new Group()
  chair.position.set(x, 0, z)
  chair.rotation.y = turn
  for (const angle of [0.3, 1.55, 2.8]) {
    const spoke = bit(chair, C.black(), -0.28, 0.04, 0.56, 0.04, 0.05, 0)
    spoke.rotation.y = angle
  }
  cylinder(chair, C.chrome(), 0, 0.06, 0.03, 0.34, 0)
  box(chair, seat, -0.27, 0.4, 0.54, 0.09, 0.5, 0)
  box(chair, seat, -0.25, 0.55, 0.5, backTop - 0.55, 0.08, -0.25).rotation.x = -0.08
  bit(chair, C.black(), -0.31, 0.49, 0.05, 0.2, 0.3, 0)
  bit(chair, C.black(), 0.26, 0.49, 0.05, 0.2, 0.3, 0)
  group.add(chair)
}

/** Glass for display cases and bottles: a faint reflective tint. */
export const GLASS = lazy(() => new MeshStandardMaterial({ color: 0xbfd8e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false }))
export const WATER_BOTTLE = lazy(() => new MeshStandardMaterial({ color: 0x5aa6d6, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.6 }))

// ---------- office images ----------

/** Marker handwriting: wobbly strokes that read as words from a distance. */
function scribble(c: CanvasRenderingContext2D, r: () => number, x: number, y: number, width: number, size: number): void {
  c.beginPath()
  let px = x
  while (px < x + width) {
    const word = size * (1.5 + r() * 3)
    c.moveTo(px, y)
    for (let step = 0; step < word; step += size * 0.35) c.lineTo(px + step, y + (r() - 0.5) * size * 0.9)
    px += word + size * 0.8
  }
  c.stroke()
}

function whiteboardImage(seed: number): CanvasTexture {
  return paint(512, 300, (c, w, h) => {
    const r = seeded(seed)
    c.fillStyle = '#eef0ee'
    c.fillRect(0, 0, w, h)
    // Ghosts of old writing that was never wiped off properly.
    c.strokeStyle = 'rgba(120,130,150,0.18)'
    c.lineWidth = 3
    for (let line = 0; line < 6; line += 1) scribble(c, r, 30 + r() * 200, 40 + r() * 220, 150 + r() * 120, 10)
    c.lineCap = 'round'
    c.lineJoin = 'round'
    if (seed % 2 === 0) {
      // A flow chart: boxes joined by arrows, a heading and a circled note.
      c.strokeStyle = '#1d3f8f'
      c.lineWidth = 3
      scribble(c, r, 24, 34, 200, 14)
      for (const [bx, by] of [[40, 80], [200, 80], [360, 80], [200, 190], [360, 200]]) {
        c.strokeRect(bx, by, 110, 50)
        scribble(c, r, bx + 10, by + 26, 85, 7)
      }
      c.beginPath()
      c.moveTo(150, 105); c.lineTo(200, 105); c.moveTo(310, 105); c.lineTo(360, 105); c.moveTo(255, 130); c.lineTo(255, 190)
      c.moveTo(310, 215); c.lineTo(360, 222)
      c.stroke()
      c.strokeStyle = '#c0262d'
      c.beginPath(); c.ellipse(415, 225, 80, 45, -0.1, 0, Math.PI * 2); c.stroke()
      scribble(c, r, 40, 270, 120, 9)
    } else {
      // A shift rota grid and a bullet list.
      c.strokeStyle = '#222'
      c.lineWidth = 3
      scribble(c, r, 24, 34, 160, 14)
      c.lineWidth = 2
      for (let row = 0; row <= 5; row += 1) { c.beginPath(); c.moveTo(24, 60 + row * 36); c.lineTo(280, 60 + row * 36); c.stroke() }
      for (let col = 0; col <= 4; col += 1) { c.beginPath(); c.moveTo(24 + col * 64, 60); c.lineTo(24 + col * 64, 240); c.stroke() }
      c.strokeStyle = '#1d6f3a'
      for (let row = 0; row < 5; row += 1) for (let col = 0; col < 4; col += 1) if (r() > 0.3) scribble(c, r, 32 + col * 64, 80 + row * 36, 40, 6)
      c.strokeStyle = '#c0262d'
      c.lineWidth = 3
      for (let item = 0; item < 5; item += 1) {
        c.beginPath(); c.arc(316, 80 + item * 34, 3, 0, Math.PI * 2); c.stroke()
        scribble(c, r, 330, 80 + item * 34, 120 + r() * 40, 9)
      }
    }
  })
}
export const WHITEBOARDS = [2, 3].map((seed) => lazy(() => printed(whiteboardImage(seed), 0.25)))

/** The site owner's corporate mark: a made-up company, lettered in light. */
export const LOGO = lazy(() => lit(paint(768, 256, (c, _w, h) => {
  c.shadowColor = 'rgba(160,230,255,0.9)'
  c.shadowBlur = 18
  c.fillStyle = '#d8f4ff'
  c.beginPath()
  // Emblem: a hexagon split by a vertical cut.
  for (let corner = 0; corner < 6; corner += 1) {
    const a = (corner / 6) * Math.PI * 2 + Math.PI / 6
    c.lineTo(120 + Math.cos(a) * 78, h / 2 + Math.sin(a) * 78)
  }
  c.closePath()
  c.fill()
  c.shadowBlur = 0
  c.globalCompositeOperation = 'destination-out'
  c.fillRect(112, 40, 16, 180)
  c.globalCompositeOperation = 'source-over'
  c.shadowBlur = 18
  c.fillStyle = '#eaf8ff'
  c.font = 'bold 92px Arial, sans-serif'
  c.fillText('HALVARD', 228, 140)
  c.font = '30px Arial, sans-serif'
  c.letterSpacing = '5px'
  c.fillStyle = '#9fd8ee'
  c.fillText('KERN SECURE LOGISTICS', 234, 194)
}), 2.2, true))

export const KIOSK_UI = lazy(() => lit(paint(160, 220, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#0f2a44')
  g.addColorStop(1, '#081422')
  c.fillStyle = g
  c.fillRect(0, 0, w, h)
  c.fillStyle = '#e8f6ff'
  c.font = 'bold 15px sans-serif'
  c.fillText('VISITOR', 14, 30)
  c.fillText('CHECK-IN', 14, 48)
  c.fillStyle = '#7fa8c8'
  c.font = '10px sans-serif'
  c.fillText('Tap your pass to begin', 14, 66)
  ;['#19e3ff', '#2a5b82', '#2a5b82', '#ffb000'].forEach((colour, index) => {
    c.fillStyle = colour
    c.fillRect(14, 84 + index * 32, w - 28, 24)
  })
  c.font = 'bold 11px sans-serif'
  c.fillStyle = '#081422'
  c.fillText('SCAN PASS', 24, 100)
  c.fillText('HELP', 24, 196)
  c.fillStyle = '#d0e4f2'
  c.fillText('DIRECTORY', 24, 132)
  c.fillText('DELIVERIES', 24, 164)
}), 1.5))

function rugImage(seed: number): CanvasTexture {
  return paint(512, 256, (c, w, h) => {
    const r = seeded(seed)
    if (seed === 5) {
      // A worn traditional rug: deep red field, borders and a central medallion.
      c.fillStyle = '#5a1a1c'
      c.fillRect(0, 0, w, h)
      c.strokeStyle = '#c8a46a'
      c.lineWidth = 10
      c.strokeRect(16, 16, w - 32, h - 32)
      c.strokeStyle = '#1e2a44'
      c.lineWidth = 6
      c.strokeRect(34, 34, w - 68, h - 68)
      c.fillStyle = '#1e2a44'
      c.beginPath(); c.ellipse(w / 2, h / 2, 90, 60, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#c8a46a'
      c.beginPath(); c.ellipse(w / 2, h / 2, 50, 32, 0, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#7a2a24'
      for (let n = 0; n < 60; n += 1) c.fillRect(50 + r() * (w - 100), 50 + r() * (h - 100), 6, 6)
    } else {
      // A modern office rug: charcoal with offset grey and ochre stripes.
      c.fillStyle = '#2c2f33'
      c.fillRect(0, 0, w, h)
      for (let band = 0; band < 9; band += 1) {
        c.fillStyle = ['#3d4146', '#4b5056', '#6b5a3c'][band % 3]
        c.fillRect(0, 20 + band * 26 + r() * 6, w, 6 + r() * 8)
      }
    }
    // Wear: lighter fibres and dirt scattered over the pile.
    for (let n = 0; n < 4000; n += 1) {
      c.fillStyle = `rgba(${r() > 0.5 ? '255,240,220' : '0,0,0'},${r() * 0.08})`
      c.fillRect(r() * w, r() * h, 2, 2)
    }
  })
}
export const RUGS = [5, 6].map((seed) => lazy(() => printed(rugImage(seed), 1)))

/** A row of book spines and box files: one textured block fills a whole shelf. */
function spinesImage(seed: number): CanvasTexture {
  return paint(512, 128, (c, w, h) => {
    const r = seeded(seed)
    c.fillStyle = '#120f0c'
    c.fillRect(0, 0, w, h)
    const colours = ['#5a1a1c', '#1d3f6e', '#2a4a2a', '#8a6a2e', '#2a2c30', '#6b5a4a', '#c9c4b6', '#7a2a24', '#1e2a44', '#3a3f44']
    for (let x = 0; x < w; ) {
      const bw = 8 + r() * 22
      const top = r() * h * 0.35
      c.fillStyle = colours[Math.floor(r() * colours.length)]
      c.fillRect(x, top, bw - 1.5, h - top)
      c.fillStyle = 'rgba(230,200,120,0.6)'
      c.fillRect(x + 2, top + 10 + r() * 8, bw - 6, 3)
      c.fillRect(x + 2, h - 18, bw - 6, 2)
      c.fillStyle = 'rgba(255,255,255,0.08)'
      c.fillRect(x, top, 2, h - top)
      x += bw
    }
  })
}
export const SPINES = [31, 32].map((seed) => lazy(() => printed(spinesImage(seed), 0.85)))

/** One palm frond, used as a cut-out card so a handful of cards read as a full plant. */
export const FROND = lazy(() => printed(paint(256, 128, (c, w, h) => {
  const r = seeded(9)
  c.strokeStyle = '#3a4a26'
  c.lineWidth = 3
  c.beginPath(); c.moveTo(4, h / 2); c.quadraticCurveTo(w / 2, h / 2 - 10, w - 4, h / 2 + 8); c.stroke()
  for (let n = 0; n < 26; n += 1) {
    const t = n / 26
    const x = 10 + t * (w - 24)
    const y = h / 2 - 10 * Math.sin(t * Math.PI) + t * 8
    const len = 52 * Math.sin(t * Math.PI * 0.9 + 0.2)
    for (const side of [-1, 1]) {
      c.fillStyle = ['#4a7a36', '#5a8a3a', '#3d6b30', '#6a9a48'][Math.floor(r() * 4)]
      c.beginPath()
      c.moveTo(x, y)
      c.quadraticCurveTo(x + 10, y + side * len * 0.6, x + 18, y + side * len)
      c.quadraticCurveTo(x + 6, y + side * len * 0.5, x + 4, y)
      c.fill()
    }
  }
}), 0.75, 'cutout'))

/** One flat-sided wall mesh using the shared box, unlit by shadows, for thin backing panels. */
export function panel(group: Group, material: Material, left: number, bottom: number, w: number, h: number, depth: number, z: number): Mesh {
  const mesh = new Mesh(BOX, material)
  mesh.scale.set(w, h, depth)
  mesh.position.set(left + w / 2, bottom + h / 2, z)
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}
