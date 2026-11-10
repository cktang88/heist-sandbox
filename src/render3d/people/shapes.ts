import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** How a surface looks: sRGB colour, roughness, metalness and how brightly it glows. */
export type Finish = { color: number; rough: number; metal?: number; glow?: number }

/** Where a piece sits inside its part, in tiles. Rotations are in radians, applied x, then y, then z. */
export type Place = { x?: number; y?: number; z?: number; rx?: number; ry?: number; rz?: number; sx?: number; sy?: number; sz?: number }

/**
 * One cross-section of a lofted shape. `front` and `back` are how far the surface reaches forward (+x)
 * and back from the centre line, `side` how far it reaches toward the camera and away. Different front
 * and back depths are what give a chest, a calf or a jaw its profile.
 */
export type Ring = { y: number; front: number; back: number; side: number; x?: number; z?: number }

/**
 * Skins a list of cross-sections, top to bottom, into a closed smooth shape. `square` (0..1) flattens
 * the sides toward a rounded box, for armour plates and pouches.
 */
export function loft(rings: readonly Ring[], segments = 12, square = 0): BufferGeometry {
  const power = 1 - 0.65 * square
  const shaped = (value: number) => Math.sign(value) * Math.pow(Math.abs(value), power)
  const positions: number[] = []
  for (const ring of rings) {
    for (let step = 0; step < segments; step += 1) {
      const angle = (step / segments) * Math.PI * 2
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      positions.push((ring.x ?? 0) + shaped(cos) * (cos > 0 ? ring.front : ring.back), ring.y, (ring.z ?? 0) + shaped(sin) * ring.side)
    }
  }
  const top = rings[0]
  const bottom = rings[rings.length - 1]
  const capTop = rings.length * segments
  positions.push(top.x ?? 0, top.y, top.z ?? 0, bottom.x ?? 0, bottom.y, bottom.z ?? 0)

  const index: number[] = []
  for (let ring = 0; ring < rings.length - 1; ring += 1) {
    for (let step = 0; step < segments; step += 1) {
      const a = ring * segments + step
      const b = ring * segments + ((step + 1) % segments)
      index.push(a, b, a + segments, b, b + segments, a + segments)
    }
  }
  const last = (rings.length - 1) * segments
  for (let step = 0; step < segments; step += 1) {
    const next = (step + 1) % segments
    index.push(capTop, next, step, capTop + 1, last + step, last + next)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(index)
  geometry.computeVertexNormals()
  return geometry
}

const scratchColor = new Color()

/**
 * Collects shaped pieces, each with its own finish, and merges them into one geometry, so a whole
 * body part with its clothing and gear draws in a single call.
 */
export class Kit {
  private readonly pieces: BufferGeometry[] = []

  add(geometry: BufferGeometry, finish: Finish, place: Place = {}): this {
    if (geometry.hasAttribute('uv')) geometry.deleteAttribute('uv')
    const matrix = new Matrix4().compose(
      new Vector3(place.x ?? 0, place.y ?? 0, place.z ?? 0),
      new Quaternion().setFromEuler(new Euler(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0)),
      new Vector3(place.sx ?? 1, place.sy ?? 1, place.sz ?? 1),
    )
    geometry.applyMatrix4(matrix)
    const count = geometry.getAttribute('position').count
    scratchColor.setHex(finish.color)
    const colors = new Float32Array(count * 3)
    const finishes = new Float32Array(count * 3)
    for (let vertex = 0; vertex < count; vertex += 1) {
      colors.set([scratchColor.r, scratchColor.g, scratchColor.b], vertex * 3)
      finishes.set([finish.rough, finish.metal ?? 0, finish.glow ?? 0], vertex * 3)
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geometry.setAttribute('finish', new Float32BufferAttribute(finishes, 3))
    this.pieces.push(geometry)
    return this
  }

  /** A box `size` = [width (x), height (y), depth (z)], centred on its place. */
  box(finish: Finish, size: readonly [number, number, number], place: Place = {}): this {
    return this.add(new BoxGeometry(size[0], size[1], size[2]), finish, place)
  }

  /** An ellipsoid with radii [x, y, z]. */
  ball(finish: Finish, radii: readonly [number, number, number], place: Place = {}, detail = 10): this {
    return this.add(new SphereGeometry(1, detail, Math.max(4, Math.round(detail * 0.7))), finish, { ...place, sx: radii[0], sy: radii[1], sz: radii[2] })
  }

  /** A cylinder along y, `top` and `bottom` radii, centred on its place. */
  tube(finish: Finish, top: number, bottom: number, length: number, place: Place = {}, detail = 10): this {
    return this.add(new CylinderGeometry(top, bottom, length, detail, 1), finish, place)
  }

  /** A cylinder lying along x, from `from` to `to`, centred on height `y`. */
  rod(finish: Finish, radius: number, from: number, to: number, y: number, z = 0, detail = 10): this {
    return this.tube(finish, radius, radius, to - from, { x: (from + to) / 2, y, z, rz: -Math.PI / 2 }, detail)
  }

  shape(finish: Finish, rings: readonly Ring[], place: Place = {}, segments = 12, square = 0): this {
    return this.add(loft(rings, segments, square), finish, place)
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.pieces)
    if (!merged) throw new Error('people kit: pieces do not share the same attributes')
    for (const piece of this.pieces) piece.dispose()
    merged.computeBoundingSphere()
    return merged
  }
}
