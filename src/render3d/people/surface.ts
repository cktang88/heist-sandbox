import { Color, MeshStandardMaterial, type WebGLProgramParametersWithUniforms } from 'three'
import type { TimeOfDay } from '../../game/site'
import { applySkyShading } from '../core/skyShading'

/**
 * Every body part, garment and weapon is drawn with one material. Colour comes from the vertices and
 * roughness, metalness and glow from a per-vertex `finish` attribute, so a whole limb with its sleeve,
 * pads and straps is a single draw call while cloth, kevlar, steel and skin still each catch light
 * their own way.
 */
/**
 * Extra flat light on people under the open sky, as a share of their own colour. High above the site (the opening
 * parachute drop) nothing else lights them from the camera's side, and the operative read as a black cut-out against
 * a bright day sky. Indoors it fades out with the sky (see `skyShading.ts`).
 */
const outdoorFill = { value: 0.12 }
const FILL: Record<TimeOfDay, number> = { day: 0.45, night: 0.12 }

export function setPeopleOutdoorFill(time: TimeOfDay): void {
  outdoorFill.value = FILL[time]
}

function addFinish(shader: WebGLProgramParametersWithUniforms): void {
  applySkyShading(shader)
  shader.uniforms.outdoorFill = outdoorFill
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nattribute vec3 finish;\nvarying vec3 vFinish;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinish = finish;')
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vFinish;\nuniform float outdoorFill;')
    .replace('#include <aomap_fragment>', '#include <aomap_fragment>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * outdoorFill * skyOpen;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vFinish.x;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vFinish.y;')
    // Glowing parts (goggle lenses, screens) shine in their own colour, strong enough to bloom.
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vFinish.z;')
}

function surface(shade: number, flash = false): MeshStandardMaterial {
  const material = new MeshStandardMaterial({ vertexColors: true, color: new Color(shade, shade, shade) })
  if (flash) {
    material.emissive.set(0xffffff)
    material.emissiveIntensity = 1.6
  }
  material.onBeforeCompile = addFinish
  return material
}

/** Parts on the near side of the body. */
export const NEAR_SURFACE = surface(1)
/** Parts on the far side are a touch darker, which keeps the two arms and legs apart at a glance. */
export const FAR_SURFACE = surface(0.72)
/** A white flash for the instant someone is hit. */
export const HIT_SURFACE = surface(1, true)
