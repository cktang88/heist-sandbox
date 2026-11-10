import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** A colour as linear red, green, blue. */
export type Tint = readonly [number, number, number]

export function tint(hex: number): Tint {
  const color = new Color(hex)
  return [color.r, color.g, color.b]
}

const UP = new Vector3(0, 1, 0)
/** A fitting is a few pixels across at play distance: eight sides read as round, and thin bars need only five. */
const SIDES = 8
const BAR_SIDES = 5

/**
 * Collects simple shapes, each with its own colour, and merges them into one geometry, so a whole lamp
 * draws with a single shared material.
 */
export class Parts {
  private readonly pieces: BufferGeometry[] = []

  get isEmpty(): boolean {
    return this.pieces.length === 0
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, color: Tint, rotation?: Euler): this {
    return this.add(new BoxGeometry(w, h, d), color, x, y, z, rotation)
  }

  /** An upright cylinder (or cone, when the radii differ) centred on its middle. `open` leaves the ends off, like a shade. */
  cylinder(x: number, y: number, z: number, top: number, bottom: number, h: number, color: Tint, open = false, rotation?: Euler): this {
    return this.add(new CylinderGeometry(top, bottom, h, SIDES, 1, open), color, x, y, z, rotation)
  }

  sphere(x: number, y: number, z: number, radius: number, color: Tint, stretchY = 1): this {
    const ball = new SphereGeometry(radius, SIDES, 5)
    ball.scale(1, stretchY, 1)
    return this.add(ball, color, x, y, z)
  }

  /** A thin round bar between two points in the x-y plane, at depth z. */
  rod(x0: number, y0: number, x1: number, y1: number, z: number, radius: number, color: Tint): this {
    return this.bar(new Vector3(x0, y0, z), new Vector3(x1, y1, z), radius, color)
  }

  /** A thin round bar between two points in space. */
  bar(from: Vector3, to: Vector3, radius: number, color: Tint): this {
    const along = to.clone().sub(from)
    const piece = new CylinderGeometry(radius, radius, along.length(), BAR_SIDES, 1, true)
    piece.applyQuaternion(new Quaternion().setFromUnitVectors(UP, along.normalize()))
    const middle = from.clone().add(to).multiplyScalar(0.5)
    return this.add(piece, color, middle.x, middle.y, middle.z)
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.pieces)
    for (const piece of this.pieces) piece.dispose()
    return merged
  }

  private add(piece: BufferGeometry, color: Tint, x: number, y: number, z: number, rotation?: Euler): this {
    const place = new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(rotation ?? new Euler()), new Vector3(1, 1, 1))
    piece.applyMatrix4(place)
    const count = piece.getAttribute('position').count
    const colors = new Float32Array(count * 3)
    for (let index = 0; index < count; index += 1) colors.set(color, index * 3)
    piece.setAttribute('color', new Float32BufferAttribute(colors, 3))
    this.pieces.push(piece)
    return this
  }
}
