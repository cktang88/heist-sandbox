import { Group, Mesh, MeshStandardMaterial, type Material } from 'three'
import { BALL, BOX, CYLINDER, glow, matte } from '../props/kit'

/** Shared surfaces for device models. Every model draws from these, so a hundred devices add no new materials. */
export const METAL = {
  dark: matte(0x23262b, 0.45, 0.7),
  grey: matte(0x6b7178, 0.4, 0.8),
  steel: matte(0xa4abb3, 0.3, 0.9),
  black: matte(0x0b0c0e, 0.5, 0.3),
  plastic: matte(0xc9c6bb, 0.6),
  olive: matte(0x3d4230, 0.6, 0.3),
  yellow: matte(0xd9a514, 0.5, 0.2),
  red: matte(0xa3140f, 0.35, 0.1),
  glass: matte(0x0d1820, 0.08, 0.6),
}
export const COVER = new MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25, depthWrite: false })

/** Status lights: red is armed and watching, green is in the player's hands, amber is waiting, off is dead. */
export type LedColour = 'red' | 'green' | 'amber' | 'off'
const LEDS: Record<LedColour, Material> = {
  red: glow(0xff2418, 7),
  green: glow(0x2bff66, 6),
  amber: glow(0xffaa22, 6),
  off: matte(0x1a1a1a, 0.4),
}
export function ledMaterial(colour: LedColour): Material {
  return LEDS[colour]
}

/** Adds a box centred on (x, y, z). Device parts are too small to cast useful shadows, so they do not. */
export function part(group: Group, material: Material, x: number, y: number, z: number, w: number, h: number, d: number): Mesh {
  const mesh = new Mesh(BOX, material)
  mesh.scale.set(w, h, d)
  mesh.position.set(x, y, z)
  group.add(mesh)
  return mesh
}

/** A cylinder lying along z, facing the viewer: buttons, lenses, knobs. */
export function disc(group: Group, material: Material, x: number, y: number, z: number, radius: number, depth: number): Mesh {
  const mesh = new Mesh(CYLINDER, material)
  mesh.rotation.x = Math.PI / 2
  mesh.scale.set(radius, depth, radius)
  mesh.position.set(x, y, z)
  group.add(mesh)
  return mesh
}

/** An upright rod: antennas and conduit. */
export function rod(group: Group, material: Material, x: number, y: number, z: number, radius: number, length: number): Mesh {
  const mesh = new Mesh(CYLINDER, material)
  mesh.scale.set(radius, length, radius)
  mesh.position.set(x, y + length / 2, z)
  group.add(mesh)
  return mesh
}

export function led(group: Group, x: number, y: number, z: number, radius = 0.028): Mesh {
  const mesh = new Mesh(BALL, LEDS.off)
  mesh.scale.setScalar(radius)
  mesh.position.set(x, y, z)
  group.add(mesh)
  return mesh
}
