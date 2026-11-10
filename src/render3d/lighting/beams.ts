import { AdditiveBlending, Color, ConeGeometry, DoubleSide, Mesh, Quaternion, ShaderMaterial, Vector3 } from 'three'

/**
 * A faint shaft of light under a ceiling spot or floodlight, as if the air were a little dusty. It is brightest
 * where you look through the most of it (the middle of the cone) and fades along its length and at its rim,
 * so it never shows a hard edge.
 */
const vertexShader = /* glsl */ `
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vAlong = -position.y;
    vec4 seen = modelViewMatrix * vec4(position, 1.0);
    vView = -seen.xyz;
    vNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * seen;
  }`

const fragmentShader = /* glsl */ `
  uniform vec3 color;
  uniform float strength;
  varying float vAlong;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float body = facing * facing;
    float along = smoothstep(0.0, 0.12, vAlong) * pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.6);
    gl_FragColor = vec4(color * strength * body * along, 1.0);
  }`

/** A unit cone with its tip at the origin, opening downward to radius 1 at y = -1. */
const CONE = new ConeGeometry(1, 1, 32, 1, true).translate(0, -0.5, 0)
const DOWN = new Vector3(0, -1, 0)

export class Beam {
  readonly mesh: Mesh
  private readonly material: ShaderMaterial
  private readonly direction = new Vector3()
  private readonly turn = new Quaternion()

  constructor() {
    this.material = new ShaderMaterial({
      vertexShader, fragmentShader, uniforms: { color: { value: new Color() }, strength: { value: 0 } },
      blending: AdditiveBlending, transparent: true, depthWrite: false, side: DoubleSide, fog: false,
    })
    this.mesh = new Mesh(CONE, this.material)
    this.mesh.renderOrder = 1
    this.mesh.visible = false
  }

  /** Shows the beam from (x, y, z) toward the aim point, `spread` being the cone's half-angle. */
  show(x: number, y: number, z: number, aimX: number, aimY: number, aimZ: number, length: number, spread: number, color: Color, strength: number): void {
    this.direction.set(aimX - x, aimY - y, aimZ - z).normalize()
    this.turn.setFromUnitVectors(DOWN, this.direction)
    this.mesh.quaternion.copy(this.turn)
    this.mesh.position.set(x, y, z)
    const radius = Math.tan(spread) * length
    this.mesh.scale.set(radius, length, radius)
    ;(this.material.uniforms.color.value as Color).copy(color)
    this.material.uniforms.strength.value = strength
    this.mesh.visible = strength > 0.002
  }

  hide(): void {
    this.mesh.visible = false
  }
}
