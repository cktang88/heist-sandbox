import { NormalBlending, ShaderMaterial } from 'three'
import type { SprayView } from '../../game/hazards/hazards'
import { createQuadPool, put4, type QuadPool } from './quads'

export const MAX_SPRAYS = 16
const DROPS_PER_SPRAY = 40
const KIND_INDEX: Record<SprayView['kind'], number> = { water: 0, foam: 1, steam: 2, gas: 3 }

/**
 * Per kind: reach in tiles, spread in radians, fall per second squared (negative rises), start and end size,
 * colour and opacity. Indexed by the kind number in the shader.
 */
const SPRAY_GLSL = /* glsl */ `
  void sprayLook(float kind, out float reach, out float spread, out float fall, out vec2 size, out vec4 colour) {
    if (kind < 0.5) { reach = 5.0; spread = 0.1; fall = 2.2; size = vec2(0.06, 0.2); colour = vec4(0.62, 0.78, 1.0, 0.6); }
    else if (kind < 1.5) { reach = 3.4; spread = 0.22; fall = 0.9; size = vec2(0.12, 0.55); colour = vec4(0.95, 0.96, 0.95, 0.85); }
    else if (kind < 2.5) { reach = 2.4; spread = 0.55; fall = -1.4; size = vec2(0.3, 1.6); colour = vec4(0.92, 0.93, 0.95, 0.26); }
    else { reach = 3.0; spread = 0.5; fall = -0.25; size = vec2(0.3, 1.9); colour = vec4(0.72, 0.82, 0.36, 0.32); }
  }
`

const sprayMaterial = () => new ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute vec4 aOrigin;
    attribute vec2 aSpray;
    uniform float uTime;
    varying vec2 vUv;
    varying vec4 vColour;
    ${SPRAY_GLSL}
    void main() {
      float seed = aOrigin.w;
      float reach; float spread; float fall; vec2 size; vec4 colour;
      sprayLook(aSpray.y, reach, spread, fall, size, colour);
      // Each drop loops along its own path out of the nozzle, so the fan needs no per-frame simulation.
      float life = fract(uTime * 1.6 + seed * 9.7);
      float angle = aSpray.x + (fract(seed * 31.7) - 0.5) * 2.0 * spread;
      vec2 direction = vec2(cos(angle), -sin(angle));
      vec3 p = aOrigin.xyz;
      p.xy += direction * reach * life * (0.75 + fract(seed * 5.3) * 0.25);
      p.y -= fall * life * life;
      p.z += (fract(seed * 17.1) - 0.5) * 0.5 * life;
      p.xy += position.xy * mix(size.x, size.y, life);
      vUv = uv;
      vColour = vec4(colour.rgb, colour.a * (1.0 - life) * smoothstep(0.0, 0.1, life));
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    varying vec4 vColour;
    void main() {
      float soft = 1.0 - smoothstep(0.1, 1.0, length(vUv - 0.5) * 2.0);
      gl_FragColor = vec4(vColour.rgb, vColour.a * soft);
    }`,
  blending: NormalBlending,
  transparent: true,
  depthWrite: false,
})

export type SprayFx = { pool: QuadPool; update(sprays: readonly SprayView[], time: number): void }

/** Extinguisher foam, sprinkler water, burst steam pipes and gas leaks as particle fans. */
export function createSprays(): SprayFx {
  const pool = createQuadPool(MAX_SPRAYS * DROPS_PER_SPRAY, { aOrigin: 4, aSpray: 2 }, sprayMaterial())
  pool.mesh.renderOrder = 3
  return {
    pool,
    update(sprays, time) {
      const { aOrigin, aSpray } = pool.data
      let count = 0
      for (let spray = 0; spray < sprays.length && spray < MAX_SPRAYS; spray += 1) {
        const { x, y, angle, kind } = sprays[spray]
        for (let drop = 0; drop < DROPS_PER_SPRAY; drop += 1) {
          put4(aOrigin, count, x, -y, 0.1, (drop * 0.6180339 + spray * 0.37) % 1)
          aSpray[count * 2] = angle
          aSpray[count * 2 + 1] = KIND_INDEX[kind]
          count += 1
        }
      }
      pool.commit(count)
      ;(pool.mesh.material as ShaderMaterial).uniforms.uTime.value = time
    },
  }
}
