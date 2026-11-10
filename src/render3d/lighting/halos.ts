import { AdditiveBlending, InstancedBufferAttribute, InstancedMesh, PlaneGeometry, ShaderMaterial } from 'three'

/**
 * Soft additive glows, all in one draw call: the pool of light a lamp throws on the wall behind it, and the haze
 * around its bulb. Every lit fitting near the view gets them, so lamps without a real light still look like they
 * light something. Each glow is a rectangle (clipped to its room, so it does not bleed through walls) with an
 * elliptical falloff whose centre and radii are given separately, so clipping does not squash the falloff.
 */
const vertexShader = /* glsl */ `
  attribute vec4 shape;
  varying vec2 vOffset;
  varying vec3 vColor;
  void main() {
    vOffset = (uv - shape.xy) / shape.zw;
    vColor = instanceColor;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`

const fragmentShader = /* glsl */ `
  varying vec2 vOffset;
  varying vec3 vColor;
  void main() {
    float d2 = dot(vOffset, vOffset);
    // Light on a surface near a bulb falls off roughly with the square of distance: a hot core and a long faint
    // tail. Shifted and scaled so it reaches exactly zero at the rim and never shows an edge.
    float light = max(0.0, (1.0 / (1.0 + 14.0 * d2) - 1.0 / 15.0) * (15.0 / 14.0));
    gl_FragColor = vec4(vColor * light, 1.0);
  }`

export class Halos {
  readonly mesh: InstancedMesh
  private readonly matrices: Float32Array
  private readonly colors: Float32Array
  private readonly shapes: Float32Array
  private readonly shape: InstancedBufferAttribute
  private readonly uploads: [InstancedBufferAttribute, number][]
  private count = 0

  constructor(private readonly capacity: number) {
    const geometry = new PlaneGeometry(1, 1)
    this.shapes = new Float32Array(capacity * 4)
    this.shape = new InstancedBufferAttribute(this.shapes, 4)
    geometry.setAttribute('shape', this.shape)
    const material = new ShaderMaterial({ vertexShader, fragmentShader, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false })
    this.mesh = new InstancedMesh(geometry, material, capacity)
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
    this.matrices = this.mesh.instanceMatrix.array as Float32Array
    this.colors = this.mesh.instanceColor.array as Float32Array
    this.uploads = [[this.mesh.instanceMatrix, 16], [this.mesh.instanceColor, 3], [this.shape, 4]]
    this.mesh.frustumCulled = false
    // Drawn after the solid scene and other glows, so it only ever adds light on top.
    this.mesh.renderOrder = 2
  }

  begin(): void {
    this.count = 0
  }

  /**
   * Adds a glow covering the rectangle `left..right` x `bottom..top` (3D units, y up) at depth z, brightest at
   * (cx, cy) and fading out over radii (rx, ry). `r, g, b` is its colour times its strength, in linear light.
   */
  add(left: number, bottom: number, right: number, top: number, z: number, cx: number, cy: number, rx: number, ry: number, r: number, g: number, b: number): void {
    const w = right - left
    const h = top - bottom
    if (this.count >= this.capacity || w <= 0.01 || h <= 0.01 || r + g + b <= 0.001) return
    const slot = this.count
    const m = this.matrices
    const at = slot * 16
    m.fill(0, at, at + 16)
    m[at] = w
    m[at + 5] = h
    m[at + 10] = 1
    m[at + 12] = left + w / 2
    m[at + 13] = bottom + h / 2
    m[at + 14] = z
    m[at + 15] = 1
    this.shapes[slot * 4] = (cx - left) / w
    this.shapes[slot * 4 + 1] = (cy - bottom) / h
    this.shapes[slot * 4 + 2] = rx / w
    this.shapes[slot * 4 + 3] = ry / h
    this.colors[slot * 3] = r
    this.colors[slot * 3 + 1] = g
    this.colors[slot * 3 + 2] = b
    this.count += 1
  }

  end(): void {
    this.mesh.count = this.count
    this.mesh.visible = this.count > 0
    // Upload only the part in use.
    for (const [attribute, size] of this.uploads) {
      attribute.clearUpdateRanges()
      attribute.addUpdateRange(0, Math.max(1, this.count) * size)
      attribute.needsUpdate = true
    }
  }
}
