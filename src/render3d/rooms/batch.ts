import { BufferGeometry, Color, Float32BufferAttribute } from 'three'

export type P3 = [number, number, number]
export type UV = [number, number]

/** Linear 0..1 colour multiplied into the material's texture, so one material can serve many paint colours. */
export type Tint = [number, number, number]

/** Takes a display (sRGB) colour, as written in design notes, and converts it to the linear values the shader multiplies. */
export function tintOf(hex: number, scale = 1): Tint {
  const color = new Color(hex)
  return [color.r * scale, color.g * scale, color.b * scale]
}

export const WHITE: Tint = [1, 1, 1]

/**
 * Collects flat faces for one material and turns them into a single geometry.
 * Unlike the level's builder it takes a full colour per face, and it can hand back where a face's
 * corners live so a finish can later be folded away when the wall or slab behind it is destroyed.
 */
export class QuadBatch {
  private positions: number[] = []
  private normals: number[] = []
  private uvs: number[] = []
  private colors: number[] = []
  private indices: number[] = []

  get isEmpty(): boolean {
    return this.indices.length === 0
  }

  /** Index of the next corner to be added: remember it before adding faces to fold them away later. */
  get mark(): number {
    return this.positions.length / 3
  }

  /** A four-cornered face; corners run anticlockwise as seen from the side the normal points to. */
  quad(corners: [P3, P3, P3, P3], normal: P3, uvs: [UV, UV, UV, UV], tint: Tint): void {
    const first = this.mark
    for (let index = 0; index < 4; index += 1) {
      this.positions.push(...corners[index])
      this.normals.push(...normal)
      this.uvs.push(...uvs[index])
      this.colors.push(...tint)
    }
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  /** An upright face looking toward the camera (+z). UVs are in world tiles divided by `scale`, shifted by `shift`. */
  facing(x0: number, y0: number, x1: number, y1: number, z: number, scale: number, tint: Tint, shift: UV = [0, 0]): void {
    const u = (x: number) => x / scale + shift[0]
    const v = (y: number) => y / scale + shift[1]
    this.quad([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], [[u(x0), v(y0)], [u(x1), v(y0)], [u(x1), v(y1)], [u(x0), v(y1)]], tint)
  }

  /** An upright face with explicit texture corners (for atlas cells such as window views and letters). */
  facingCell(x0: number, y0: number, x1: number, y1: number, z: number, cell: [number, number, number, number], tint: Tint): void {
    const [u0, v0, u1, v1] = cell
    this.quad([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], [0, 0, 1], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], tint)
  }

  /** A level face looking up (a floor) or down (a ceiling), spanning depth z0..z1 (z0 at the back). */
  level(x0: number, x1: number, y: number, z0: number, z1: number, up: boolean, scale: number, tint: Tint, shift: UV = [0, 0]): void {
    const u = (x: number) => x / scale + shift[0]
    const v = (z: number) => z / scale + shift[1]
    if (up) this.quad([[x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0]], [0, 1, 0], [[u(x0), v(z1)], [u(x1), v(z1)], [u(x1), v(z0)], [u(x0), v(z0)]], tint)
    else this.quad([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], [0, -1, 0], [[u(x0), v(z0)], [u(x1), v(z0)], [u(x1), v(z1)], [u(x0), v(z1)]], tint)
  }

  /** An upright face looking sideways (-x or +x), spanning depth z0..z1. */
  side(x: number, y0: number, y1: number, z0: number, z1: number, towardRight: boolean, scale: number, tint: Tint): void {
    const u = (z: number) => z / scale
    const v = (y: number) => y / scale
    if (towardRight) this.quad([[x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1]], [1, 0, 0], [[u(z1), v(y0)], [u(z0), v(y0)], [u(z0), v(y1)], [u(z1), v(y1)]], tint)
    else this.quad([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], [-1, 0, 0], [[u(z0), v(y0)], [u(z1), v(y0)], [u(z1), v(y1)], [u(z0), v(y1)]], tint)
  }

  /** A box; the back face is left out because every box here sits against something or is never seen from behind. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, scale: number, tint: Tint): void {
    this.facing(x0, y0, x1, y1, z1, scale, tint)
    this.level(x0, x1, y1, z0, z1, true, scale, tint)
    this.level(x0, x1, y0, z0, z1, false, scale, tint)
    this.side(x0, y0, y1, z0, z1, false, scale, tint)
    this.side(x1, y0, y1, z0, z1, true, scale, tint)
  }

  /** A round pipe lying along x, as an eight-sided tube, centred at height y and depth z. */
  pipeAlongX(x0: number, x1: number, y: number, z: number, radius: number, tint: Tint): void {
    this.tube(radius, tint, (along, a, b) => [along ? x1 : x0, y + a, z + b], (a, b) => [0, a, b])
  }

  /** A round pipe standing upright, centred at x and depth z. */
  pipeAlongY(y0: number, y1: number, x: number, z: number, radius: number, tint: Tint): void {
    this.tube(radius, tint, (along, a, b) => [x + b, along ? y1 : y0, z + a], (a, b) => [b, 0, a])
  }

  private tube(radius: number, tint: Tint, at: (along: boolean, a: number, b: number) => P3, normal: (a: number, b: number) => P3): void {
    const sides = 8
    for (let side = 0; side < sides; side += 1) {
      const t0 = (side / sides) * Math.PI * 2
      const t1 = ((side + 1) / sides) * Math.PI * 2
      const mid = (t0 + t1) / 2
      const [a0, b0, a1, b1] = [Math.sin(t0) * radius, Math.cos(t0) * radius, Math.sin(t1) * radius, Math.cos(t1) * radius]
      this.quad([at(false, a0, b0), at(true, a0, b0), at(true, a1, b1), at(false, a1, b1)], normal(Math.sin(mid), Math.cos(mid)),
        [[0, side / sides], [1, side / sides], [1, (side + 1) / sides], [0, (side + 1) / sides]], tint)
    }
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    geometry.setIndex(this.indices)
    geometry.computeBoundingSphere()
    return geometry
  }
}
