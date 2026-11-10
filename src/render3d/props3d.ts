import { BoxGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Material } from 'three'
import type { Lamp, Prop } from '../game/level'
import { propSpec } from '../game/propCatalog'
import type { SurfaceMaterials } from './levelMesh'

const BOX = new BoxGeometry(1, 1, 1)
// Wall materials tint by a per-corner colour, so plain boxes need a white one to show their texture.
BOX.setAttribute('color', new Float32BufferAttribute(new Float32Array(BOX.attributes.position.count * 3).fill(1), 3))
const BALL = new SphereGeometry(1, 12, 10)
const WHEEL = new CylinderGeometry(1, 1, 1, 18)

const matte = (color: number, roughness = 0.8, metalness = 0) => new MeshStandardMaterial({ color, roughness, metalness })
const glow = (color: number, strength: number) => new MeshStandardMaterial({ color: 0x050505, emissive: color, emissiveIntensity: strength })

const DARK_METAL = matte(0x1b1f27, 0.5, 0.7)
const GREY_METAL = matte(0x57616e, 0.45, 0.8)
const PLASTIC = matte(0x14171d, 0.4)
const SCREEN = glow(0x5fb3d6, 1.6)
const LED_GREEN = glow(0x39ff6a, 5)
const LED_AMBER = glow(0xffb454, 5)
const LEAF = matte(0x2f6a3a, 0.7)
const POT = matte(0x7a4a35, 0.9)
const GOLD = new MeshStandardMaterial({ color: 0xffc94a, roughness: 0.25, metalness: 1 })
const RUBBER = matte(0x0b0c0e, 0.9)
const VAN_PAINT = matte(0x1e252f, 0.35, 0.6)
const TAIL_LIGHT = glow(0xff2a1a, 4)
const WHITE_CASE = matte(0xe9edf2, 0.5)
const RED_CROSS = matte(0xd0252f, 0.5)
export const LAMP_ON = glow(0xffe6bd, 9)
export const LAMP_OFF = matte(0x30343c, 0.6)
const CANVAS_OLIVE = matte(0x3d4a36, 0.85)

/** Adds a box given its left, bottom, width and height (y up), centred at depth z. */
function box(group: Group, material: Material, left: number, bottom: number, w: number, h: number, depth: number, z = 0): Mesh {
  const mesh = new Mesh(BOX, material)
  mesh.scale.set(w, h, depth)
  mesh.position.set(left + w / 2, bottom + h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** Furniture, built standing on y = 0 and centred on x = 0, pushed back toward the wall. */
export function buildProp(kind: Prop['kind'], materials: SurfaceMaterials): Group {
  const group = new Group()
  const back = -1.5
  switch (kind) {
    case 'desk':
      box(group, materials.wood, -1, 0.74, 2, 0.1, 0.9, back)
      for (const x of [-0.92, 0.82]) for (const z of [-0.35, 0.35]) box(group, DARK_METAL, x, 0, 0.1, 0.74, 0.1, back + z)
      box(group, PLASTIC, -0.35, 1.0, 0.8, 0.5, 0.05, back - 0.1)
      box(group, SCREEN, -0.31, 1.04, 0.72, 0.42, 0.02, back - 0.06)
      box(group, PLASTIC, 0, 0.84, 0.1, 0.18, 0.08, back - 0.1)
      box(group, PLASTIC, -0.3, 0.84, 0.5, 0.03, 0.18, back + 0.2)
      break
    case 'filingCabinet':
      box(group, GREY_METAL, -0.5, 0, 1, 1.9, 0.6, back - 0.3)
      for (const y of [0.1, 0.7, 1.3]) box(group, DARK_METAL, -0.12, y + 0.25, 0.24, 0.05, 0.04, back + 0.02)
      break
    case 'crate':
      box(group, materials.wood, -0.6, 0, 1.2, 1.1, 1.1, back + 0.4)
      break
    case 'plant': {
      box(group, POT, -0.25, 0, 0.5, 0.5, 0.5, back + 0.3)
      for (const [x, y, r] of [[0, 1.0, 0.36], [-0.28, 0.75, 0.26], [0.28, 0.78, 0.26], [0.05, 1.35, 0.24]]) {
        const leaf = new Mesh(BALL, LEAF)
        leaf.scale.setScalar(r)
        leaf.position.set(x, y, back + 0.3)
        leaf.castShadow = true
        group.add(leaf)
      }
      break
    }
    case 'serverRack':
      box(group, DARK_METAL, -0.55, 0, 1.1, 2.4, 0.9, back - 0.2)
      for (let row = 0; row < 7; row += 1) {
        box(group, PLASTIC, -0.45, 0.14 + row * 0.32, 0.9, 0.24, 0.04, back + 0.26)
        box(group, row % 3 === 0 ? LED_AMBER : LED_GREEN, 0.25, 0.22 + row * 0.32, 0.07, 0.07, 0.03, back + 0.29)
      }
      break
    case 'gold':
      for (const [x, y] of [[-0.5, 0], [0, 0], [-0.25, 0.2]]) box(group, GOLD, x, y, 0.48, 0.19, 0.7, back + 0.5)
      break
    default: {
      // Not modelled yet: a plain block of the right size stands in.
      const { w, h, mount } = propSpec(kind)
      if (mount === 'floor') box(group, GREY_METAL, -w / 2, 0, w, h, Math.min(1, w), back + 0.3)
    }
  }
  return group
}

export function buildVan(): Group {
  const group = new Group()
  box(group, VAN_PAINT, 0, 0.45, 6, 1.9, 2.2, -0.6)
  box(group, VAN_PAINT, 4.4, 0.45, 1.6, 1.3, 2.2, -0.6)
  box(group, PLASTIC, 4.5, 1.2, 1.3, 0.75, 2.24, -0.6)
  box(group, TAIL_LIGHT, -0.03, 0.8, 0.06, 0.3, 0.3, 0.3)
  for (const x of [1.2, 4.8]) {
    const wheel = new Mesh(WHEEL, RUBBER)
    wheel.rotation.x = Math.PI / 2
    wheel.scale.set(0.45, 0.4, 0.45)
    wheel.position.set(x, 0.45, 0.45)
    wheel.castShadow = true
    group.add(wheel)
  }
  return group
}

export function buildLamp(lamp: Lamp): { group: Group; bulb: Mesh } {
  const group = new Group()
  if (lamp.hung) box(group, DARK_METAL, -0.04, 0, 0.08, 0.3, 0.08, -0.6)
  else {
    box(group, DARK_METAL, -0.08, -5.5, 0.16, 5.5, 0.16, -1.2)
    box(group, DARK_METAL, -0.08, -0.08, 0.16, 0.16, 0.8, -0.85)
  }
  box(group, DARK_METAL, -0.45, -0.1, 0.9, 0.1, 0.3, -0.6)
  const bulb = box(group, LAMP_ON, -0.38, -0.16, 0.76, 0.07, 0.2, -0.6)
  bulb.castShadow = false
  return { group, bulb }
}

export function buildLoot(): Group {
  const group = new Group()
  box(group, GOLD, 0, 0, 0.8, 0.6, 0.35)
  box(group, DARK_METAL, 0.28, 0.6, 0.24, 0.12, 0.06)
  return group
}

export function buildPickup(kind: 'medkit' | 'ammo'): Group {
  const group = new Group()
  if (kind === 'medkit') {
    box(group, WHITE_CASE, 0, 0, 0.7, 0.55, 0.4)
    box(group, RED_CROSS, 0.29, 0.1, 0.12, 0.35, 0.42)
    box(group, RED_CROSS, 0.17, 0.21, 0.36, 0.12, 0.42)
  } else {
    box(group, CANVAS_OLIVE, 0, 0, 0.7, 0.5, 0.45)
    box(group, GOLD, 0.1, 0.3, 0.5, 0.08, 0.47)
  }
  return group
}

export function buildParachute(): Group {
  const group = new Group()
  const canopy = new Mesh(new SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), CANVAS_OLIVE)
  canopy.scale.set(2, 1.1, 1.3)
  canopy.position.y = 2.2
  canopy.castShadow = true
  group.add(canopy)
  for (const [x, z] of [[-1.7, 0.6], [1.7, 0.6], [-1.7, -0.6], [1.7, -0.6]]) {
    const line = new Mesh(WHEEL, PLASTIC)
    const length = Math.hypot(x, 2.3, z)
    line.scale.set(0.012, length, 0.012)
    line.position.set(x / 2, 1.2, z / 2)
    line.lookAt(x, 2.4, z)
    line.rotateX(Math.PI / 2)
    group.add(line)
  }
  return group
}

export function buildDrone(): Group {
  const group = new Group()
  box(group, PLASTIC, -0.3, -0.06, 0.6, 0.14, 0.4)
  for (const x of [-0.3, 0.3]) for (const z of [-0.22, 0.22]) {
    const rotor = new Mesh(WHEEL, GREY_METAL)
    rotor.scale.set(0.16, 0.012, 0.16)
    rotor.position.set(x, 0.12, z)
    group.add(rotor)
  }
  box(group, TAIL_LIGHT, -0.03, -0.1, 0.06, 0.05, 0.06, 0.2)
  return group
}

export const CHARGE_MATERIAL = matte(0xb9b08c, 0.8)
export const CHARGE_LIGHT = TAIL_LIGHT
export { BOX }
