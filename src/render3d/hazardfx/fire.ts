import { AdditiveBlending, Group, ShaderMaterial } from 'three'
import type { FireCell } from '../../game/hazards/hazards'
import { NOISE_GLSL } from './glsl'
import { cellSeed, createQuadPool, put3, put4 } from './quads'

/** Up to three tongues of flame per burning tile: one deep in the room, one mid-room, one in the walking lane. */
export const MAX_FLAMES = 900
export const MAX_EMBERS = 420
const FLAME_DEPTHS = [-1.75, -0.85, 0.15]
/** Brightness of the flame core. Well above 1, so the glow pass blooms it. */
const FLAME_GAIN = 0.85

const flameMaterial = () => new ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uGain: { value: FLAME_GAIN } },
  vertexShader: /* glsl */ `
    attribute vec4 aCell;
    attribute vec3 aShape;
    varying vec2 vUv;
    varying float vSeed;
    varying float vHeat;
    void main() {
      vUv = uv;
      vSeed = aCell.w;
      vHeat = aShape.z;
      vec3 p = vec3(aCell.x + position.x * aShape.x, aCell.y + (position.y + 0.5) * aShape.y, aCell.z);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uGain;
    varying vec2 vUv;
    varying float vSeed;
    varying float vHeat;
    ${NOISE_GLSL}
    void main() {
      vec2 uv = vUv;
      float rise = uTime * (2.0 + vSeed * 0.8);
      float n = fbm(vec2(uv.x * 3.0 + vSeed * 13.0, uv.y * 2.2 - rise - vSeed * 5.0));
      float n2 = valueNoise(vec2(uv.x * 7.0 - vSeed * 7.0, uv.y * 5.0 - rise * 1.8));
      // Classic noise fire: a rounded heat shape, eaten away by rising noise more strongly the higher it gets,
      // which breaks the top into separate licking tongues.
      float x = (uv.x - 0.5) * 2.0;
      float shape = (1.0 - x * x) * (1.0 - uv.y) * (1.15 + vHeat * 0.5);
      float f = shape - (n * 0.75 + n2 * 0.25) * (0.3 + uv.y * 0.85);
      f = clamp(f * 2.4, 0.0, 1.0) * smoothstep(0.0, 0.06, uv.y);
      float core = f * (1.0 - smoothstep(0.1, 0.45, uv.y));
      vec3 colour = vec3(0.35, 0.03, 0.0);
      colour = mix(colour, vec3(1.0, 0.22, 0.02), smoothstep(0.1, 0.5, f));
      colour = mix(colour, vec3(1.0, 0.52, 0.1), smoothstep(0.5, 0.85, f));
      colour = mix(colour, vec3(1.5, 1.2, 0.75), smoothstep(0.75, 1.0, core));
      gl_FragColor = vec4(colour * f * uGain, 1.0);
    }`,
  blending: AdditiveBlending,
  transparent: true,
  depthWrite: false,
})

const emberMaterial = () => new ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    attribute vec4 aOrigin;
    uniform float uTime;
    varying vec2 vUv;
    varying float vFade;
    void main() {
      float seed = aOrigin.w;
      // Each ember loops forever on its own clock: rise, drift, shrink, die. No per-frame bookkeeping needed.
      float life = fract(uTime * (0.3 + seed * 0.45) + seed * 7.0);
      vec3 p = aOrigin.xyz;
      p.x += (seed - 0.5) * 0.9 + sin(uTime * (2.0 + seed * 3.0) + seed * 40.0) * 0.35 * life;
      p.y += life * (2.2 + seed * 2.8);
      float size = (0.05 + fract(seed * 13.0) * 0.05) * (1.0 - life * 0.6);
      p.xy += position.xy * size;
      vUv = uv;
      vFade = (1.0 - life) * smoothstep(0.0, 0.06, life);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    varying vec2 vUv;
    varying float vFade;
    void main() {
      float glow = (1.0 - smoothstep(0.15, 1.0, length(vUv - 0.5) * 2.0)) * vFade;
      gl_FragColor = vec4(vec3(4.5, 1.7, 0.35) * glow, 1.0);
    }`,
  blending: AdditiveBlending,
  transparent: true,
  depthWrite: false,
})

export type FireFx = { group: Group; update(cells: readonly FireCell[], picked: readonly number[], time: number): void }

/** Flames and embers for every burning tile near the view, in two draw calls. */
export function createFire(): FireFx {
  const flames = createQuadPool(MAX_FLAMES, { aCell: 4, aShape: 3 }, flameMaterial())
  const embers = createQuadPool(MAX_EMBERS, { aOrigin: 4 }, emberMaterial())
  const group = new Group()
  // Drawn after smoke, so flames glow through the soot they make.
  flames.mesh.renderOrder = embers.mesh.renderOrder = 3
  group.add(flames.mesh, embers.mesh)

  return {
    group,
    update(cells, picked, time) {
      const cell4 = flames.data.aCell
      const shape = flames.data.aShape
      const origin = embers.data.aOrigin
      let flameCount = 0
      let emberCount = 0
      for (const index of picked) {
        const { x, y, intensity } = cells[index]
        const seed = cellSeed(x, y)
        const heat = Math.max(0.15, Math.min(1, intensity))
        for (let layer = 0; layer < FLAME_DEPTHS.length && flameCount < MAX_FLAMES; layer += 1) {
          // A weak fire stays in the room; the tongue in the walking lane needs real heat.
          if (layer === 2 && heat < 0.6) continue
          const jitter = Math.sin(seed * 91 + layer * 17)
          const size = layer === 2 ? 0.75 : 1
          put4(cell4, flameCount, x + 0.5 + jitter * 0.28, -(y + 1) - 0.05, FLAME_DEPTHS[layer], (seed + layer * 0.37) % 1)
          put3(shape, flameCount, (1.1 + heat * 0.7) * size, (0.9 + heat * 2.1) * size * (0.85 + jitter * 0.15), heat)
          flameCount += 1
        }
        for (let ember = 0; ember < Math.ceil(heat * 3) && emberCount < MAX_EMBERS; ember += 1) {
          put4(origin, emberCount, x + 0.5, -(y + 1) + 0.6, -1.4 + ember * 0.6, (seed * 7.3 + ember * 0.311) % 1)
          emberCount += 1
        }
      }
      flames.commit(flameCount)
      embers.commit(emberCount)
      ;(flames.mesh.material as ShaderMaterial).uniforms.uTime.value = time
      ;(embers.mesh.material as ShaderMaterial).uniforms.uTime.value = time
    },
  }
}
