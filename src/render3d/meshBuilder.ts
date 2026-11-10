import { BufferGeometry, Float32BufferAttribute } from 'three'

export type P3 = [number, number, number]
export type Rgb = [number, number, number]

/** Collects quads for one material and turns them into a single mesh geometry. */
export class MeshBuilder {
  private positions: number[] = []
  private normals: number[] = []
  private uvs: number[] = []
  private colors: number[] = []
  private indices: number[] = []

  get isEmpty(): boolean {
    return this.indices.length === 0
  }

  /** Adds a four-cornered face. Corners run anticlockwise as seen from the side the normal points to. */
  quad(corners: [P3, P3, P3, P3], normal: P3, uvs: [number, number][], shade: number): void {
    const first = this.positions.length / 3
    corners.forEach((corner, index) => {
      this.positions.push(...corner)
      this.normals.push(...normal)
      this.uvs.push(...uvs[index])
      this.colors.push(shade, shade, shade)
    })
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  /**
   * Adds a four-cornered face whose facing is worked out from its corners (anticlockwise seen from the front),
   * with its own colour at each corner. Used for bevels, whose corners need not lie in one plane.
   */
  face(corners: [P3, P3, P3, P3], uvs: [number, number][], colors: [Rgb, Rgb, Rgb, Rgb]): void {
    const [a, b, c, d] = corners
    // Diagonals cross at the face's middle, so their cross product is a fair average facing for a slightly bent quad.
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
    const v = [d[0] - b[0], d[1] - b[1], d[2] - b[2]]
    const n: P3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
    const length = Math.hypot(...n) || 1
    const first = this.positions.length / 3
    corners.forEach((corner, index) => {
      this.positions.push(...corner)
      this.normals.push(n[0] / length, n[1] / length, n[2] / length)
      this.uvs.push(...uvs[index])
      this.colors.push(...colors[index])
    })
    this.indices.push(first, first + 1, first + 2, first, first + 2, first + 3)
  }

  /** Adds all six faces of a box, textured in world space so neighbouring boxes line up. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, uvScale: number, shade: number): void {
    const s = uvScale
    this.quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], [[x0 * s, y0 * s], [x1 * s, y0 * s], [x1 * s, y1 * s], [x0 * s, y1 * s]], shade)
    this.quad([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], [[x1 * s, y0 * s], [x0 * s, y0 * s], [x0 * s, y1 * s], [x1 * s, y1 * s]], shade)
    this.quad([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]], shade)
    this.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], shade)
    this.quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], [[z0 * s, y0 * s], [z1 * s, y0 * s], [z1 * s, y1 * s], [z0 * s, y1 * s]], shade)
    this.quad([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], [[z1 * s, y0 * s], [z0 * s, y0 * s], [z0 * s, y1 * s], [z1 * s, y1 * s]], shade)
  }

  /**
   * The four sides of a box and its back, without the front (z1) face, textured in world space per facing.
   * `front` and `back` colour the corners nearest and furthest from the camera, so deep faces can darken inward.
   */
  sides(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, uvScale: number, front: Rgb, back: Rgb): void {
    const s = uvScale
    this.face([[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [[x1 * s, y0 * s], [x0 * s, y0 * s], [x0 * s, y1 * s], [x1 * s, y1 * s]], [back, back, back, back])
    this.face([[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [[x0 * s, z1 * s], [x1 * s, z1 * s], [x1 * s, z0 * s], [x0 * s, z0 * s]], [front, front, back, back])
    this.face([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [[x0 * s, z0 * s], [x1 * s, z0 * s], [x1 * s, z1 * s], [x0 * s, z1 * s]], [back, back, front, front])
    this.face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [[z0 * s, y0 * s], [z1 * s, y0 * s], [z1 * s, y1 * s], [z0 * s, y1 * s]], [back, front, front, back])
    this.face([[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [[z1 * s, y0 * s], [z0 * s, y0 * s], [z0 * s, y1 * s], [z1 * s, y1 * s]], [front, back, back, front])
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(this.positions, 3))
    geometry.setAttribute('normal', new Float32BufferAttribute(this.normals, 3))
    geometry.setAttribute('uv', new Float32BufferAttribute(this.uvs, 2))
    geometry.setAttribute('color', new Float32BufferAttribute(this.colors, 3))
    geometry.setIndex(this.indices)
    // Chunks are culled against the view by their bounds, so those must be right from the start.
    geometry.computeBoundingSphere()
    return geometry
  }
}
