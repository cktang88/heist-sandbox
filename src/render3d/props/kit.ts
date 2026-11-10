import { BoxGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, SphereGeometry, type Material } from 'three'
import { modelPlaceholder } from '../assets'
import { MODELS } from '../assetManifest'

/**
 * Shared building blocks for prop models. One unit is one tile (about 1.1 m).
 * Floor props: stand on y = 0, centred on x = 0; z = 0 is the walking lane and the back wall is near z = -2.4,
 * so furniture normally sits at z between -2 and -0.6. Keep things in front of z = 0 rare and low.
 */
export const BOX = new BoxGeometry(1, 1, 1)
// Wall materials tint by a per-corner colour, so plain boxes need a white one to show their texture.
BOX.setAttribute('color', new Float32BufferAttribute(new Float32Array(BOX.attributes.position.count * 3).fill(1), 3))
export const CYLINDER = new CylinderGeometry(1, 1, 1, 20)
export const BALL = new SphereGeometry(1, 16, 12)

/** Metres to tiles. Scanned models are in metres. */
export const TILES_PER_METRE = 1 / 1.1

const cache = new Map<string, MeshStandardMaterial>()
/** A plain surface. Results are shared, so the same colour never makes a second material. */
export function matte(color: number, roughness = 0.8, metalness = 0): MeshStandardMaterial {
  const key = `${color}:${roughness}:${metalness}`
  return cache.get(key) ?? cache.set(key, new MeshStandardMaterial({ color, roughness, metalness })).get(key)!
}
/** A surface that gives off light (screens, LEDs, neon). `strength` above 1 blooms. */
export function glow(color: number, strength: number): MeshStandardMaterial {
  const key = `glow:${color}:${strength}`
  return cache.get(key) ?? cache.set(key, new MeshStandardMaterial({ color: 0x050505, emissive: color, emissiveIntensity: strength })).get(key)!
}

/** Adds a box by its left edge, bottom edge, width and height, centred at depth `z` and `depth` thick. */
export function box(group: Group, material: Material, left: number, bottom: number, w: number, h: number, depth: number, z = 0): Mesh {
  const mesh = new Mesh(BOX, material)
  mesh.scale.set(w, h, depth)
  mesh.position.set(left + w / 2, bottom + h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

/** Adds an upright cylinder centred on x, standing on `bottom`. */
export function cylinder(group: Group, material: Material, x: number, bottom: number, radius: number, h: number, z = 0): Mesh {
  const mesh = new Mesh(CYLINDER, material)
  mesh.scale.set(radius, h, radius)
  mesh.position.set(x, bottom + h / 2, z)
  mesh.castShadow = true
  mesh.receiveShadow = true
  group.add(mesh)
  return mesh
}

export function ball(group: Group, material: Material, x: number, y: number, radius: number, z = 0): Mesh {
  const mesh = new Mesh(BALL, material)
  mesh.scale.setScalar(radius)
  mesh.position.set(x, y, z)
  mesh.castShadow = true
  group.add(mesh)
  return mesh
}

export type ScanOptions = {
  /** Uniform extra scale on top of metres-to-tiles (e.g. 0.1 for a model authored ten times too big). */
  scale?: number
  /** Turn about the vertical axis, in radians, so the model's best side faces the camera (+z). */
  turn?: number
  /** Where its centre goes across (x) and in depth (z), and how far its base sits above the floor. */
  x?: number
  z?: number
  lift?: number
}

/**
 * Adds a photo-scanned model from the asset list by id, standing on the floor.
 * It appears once loaded. Returns false if the id is unknown, so the caller can fall back to shapes.
 */
export function scanned(group: Group, id: string, options: ScanOptions = {}): boolean {
  const asset = MODELS.find((model) => model.id === id)
  if (!asset) return false
  const holder = modelPlaceholder(asset.url)
  holder.scale.setScalar(TILES_PER_METRE * (options.scale ?? 1))
  holder.rotation.y = options.turn ?? 0
  holder.position.set(options.x ?? 0, options.lift ?? 0, options.z ?? -1.4)
  group.add(holder)
  return true
}
