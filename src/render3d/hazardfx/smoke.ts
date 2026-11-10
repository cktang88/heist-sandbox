import { NormalBlending, ShaderMaterial } from 'three'
import type { FireCell, SmokeCell } from '../../game/hazards/hazards'
import type { Vec } from '../../game/types'
import { NOISE_GLSL } from './glsl'
import { cellSeed, createQuadPool, put4, type QuadPool } from './quads'

export const MAX_SMOKE_QUADS = 1300
/** Smoke fills the walking lane's depth: one puff deep in the room, one mid-room, one in front of the people. */
const SMOKE_DEPTHS = [-1.5, -0.55, 0.4]
/** Each burning tile sends up a couple of rising soot puffs. Kept to a share of the pool so real smoke always fits. */
const MAX_PLUMES = 360
const PLUME_DEPTHS = [-1.3, -0.2]

const smokeMaterial = () => new ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute vec4 aPos;
    attribute vec4 aLook;
    attribute float aRise;
    uniform float uTime;
    varying vec2 vUv;
    varying float vUp;
    varying float vAlpha;
    varying float vSeed;
    varying vec2 vTint;
    void main() {
      float seed = aPos.w;
      float size = aLook.x;
      float alpha = aLook.y;
      vec3 p = aPos.xyz;
      // Each puff drifts and turns slowly around its tile, so a cloud churns instead of sitting still.
      p.x += sin(uTime * 0.31 + seed * 30.0) * 0.28;
      p.y += cos(uTime * 0.23 + seed * 20.0) * 0.2;
      if (aRise > 0.5) {
        float life = fract(uTime * 0.2 + seed * 5.0);
        p.y += life * 3.4;
        p.x += sin(seed * 12.0 + uTime * 0.5) * 0.45 * life;
        size *= 0.55 + life * 1.4;
        alpha *= smoothstep(0.0, 0.18, life) * (1.0 - life);
      }
      float turn = seed * 6.283 + uTime * 0.09 * (seed - 0.5);
      vec2 corner = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * position.xy;
      p.xy += corner * size;
      vUv = uv;
      vUp = corner.y + 0.5;
      vAlpha = alpha;
      vSeed = seed;
      vTint = aLook.zw;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec2 vUv;
    varying float vUp;
    varying float vAlpha;
    varying float vSeed;
    varying vec2 vTint;
    ${NOISE_GLSL}
    void main() {
      vec2 q = vUv - 0.5;
      float n = fbm(q * 2.4 + vec2(vSeed * 17.0 + uTime * 0.05, vSeed * 9.0 - uTime * 0.08));
      float r = length(q) * 2.0;
      // The second term keeps the puff inside its quad, so no straight edges ever show.
      float edge = smoothstep(1.0, 0.15, r + (n - 0.5) * 0.85) * smoothstep(1.0, 0.75, r);
      float alpha = clamp(edge * vAlpha * (0.6 + n * 0.7), 0.0, 1.0);
      float toxic = vTint.x;
      float light = vTint.y;
      // Lit from above: the underside of a cloud is darker. Light here is the room's light at that tile.
      float shade = mix(0.5, 1.08, clamp(vUp, 0.0, 1.0)) * (0.78 + n * 0.4);
      vec3 colour = mix(vec3(0.6, 0.61, 0.64), vec3(0.085, 0.068, 0.055), toxic) * shade * light;
      gl_FragColor = vec4(colour, alpha);
    }`,
  blending: NormalBlending,
  transparent: true,
  depthWrite: false,
})

export type SmokeFx = {
  pool: QuadPool
  update(smoke: readonly SmokeCell[], picked: readonly number[], fire: readonly FireCell[], firePicked: readonly number[], lightAt: (at: Vec) => number, time: number): void
}

/** Billowing grenade smoke and soot, drawn as overlapping soft puffs in a single call. */
export function createSmoke(): SmokeFx {
  const pool = createQuadPool(MAX_SMOKE_QUADS, { aPos: 4, aLook: 4, aRise: 1 }, smokeMaterial())
  pool.mesh.renderOrder = 2
  const spot = { x: 0, y: 0 }

  return {
    pool,
    update(smoke, picked, fire, firePicked, lightAt, time) {
      const { aPos, aLook, aRise } = pool.data
      let count = 0
      let plumes = 0
      for (const index of firePicked) {
        const { x, y, intensity } = fire[index]
        const seed = cellSeed(x, y)
        for (let layer = 0; layer < PLUME_DEPTHS.length && plumes < MAX_PLUMES; layer += 1) {
          // Soot starts above the flame tips, so it never smothers the fire it comes from.
          put4(aPos, count, x + 0.5, -(y + 1) + 1.4 + intensity * 2, PLUME_DEPTHS[layer], (seed + layer * 0.5) % 1)
          put4(aLook, count, 1.5 + intensity, 0.35 + intensity * 0.35, 1, 0.5)
          aRise[count] = 1
          count += 1
          plumes += 1
        }
      }
      for (const index of picked) {
        const cell = smoke[index]
        if (cell.density <= 0.01) continue
        spot.x = cell.x + 0.5
        spot.y = cell.y + 0.5
        const light = 0.28 + lightAt(spot) * 0.6
        const seed = cellSeed(cell.x, cell.y)
        // Three overlapping puffs of near-full opacity make a dense cloud a solid wall; thin smoke stays see-through.
        const alpha = Math.min(1, cell.density * 1.1) * 0.82
        for (let layer = 0; layer < SMOKE_DEPTHS.length && count < MAX_SMOKE_QUADS; layer += 1) {
          const layerSeed = (seed + layer * 0.331) % 1
          put4(aPos, count, cell.x + 0.5 + (layerSeed - 0.5) * 0.4, -(cell.y + 0.5), SMOKE_DEPTHS[layer], layerSeed)
          put4(aLook, count, 2.1 + cell.density * 0.9, alpha, cell.toxic ? 1 : 0, light)
          aRise[count] = 0
          count += 1
        }
      }
      pool.commit(count)
      ;(pool.mesh.material as ShaderMaterial).uniforms.uTime.value = time
    },
  }
}
