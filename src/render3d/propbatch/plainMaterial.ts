import { FrontSide, MeshStandardMaterial, type Material, type WebGLProgramParametersWithUniforms } from 'three'
import { applySkyShading } from '../core/skyShading'

/**
 * Most prop parts are plain coloured surfaces (`matte` and `glow` in the kit): a few hundred materials that differ
 * only in colour, glow, roughness and metalness. Batches carry those four values per vertex instead, so every plain
 * part of every prop can share one material and be drawn together.
 */

/** Per-vertex values a plain part carries. Colours are linear, as three keeps them; glow is premultiplied by its strength. */
export type PlainLook = { color: [number, number, number]; glow: [number, number, number]; roughness: number; metalness: number }

const TEXTURE_SLOTS = [
  'map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'lightMap', 'bumpMap', 'displacementMap', 'envMap',
] as const

/** True when a material is nothing but colour, glow, roughness and metalness, so it can be folded into the shared one. */
export function isPlain(material: Material): material is MeshStandardMaterial {
  if (!(material instanceof MeshStandardMaterial) || material.type !== 'MeshStandardMaterial') return false
  if (TEXTURE_SLOTS.some((slot) => material[slot] !== null)) return false
  if (Object.prototype.hasOwnProperty.call(material, 'onBeforeCompile')) return false
  return !material.transparent && material.opacity === 1 && material.side === FrontSide && material.alphaTest === 0
    && !material.vertexColors && !material.flatShading && !material.wireframe && material.envMapIntensity === 1
    && material.depthWrite && material.depthTest && material.colorWrite && !material.polygonOffset && material.visible
}

export function plainLook(material: MeshStandardMaterial): PlainLook {
  const { color, emissive, emissiveIntensity: strength } = material
  return {
    color: [color.r, color.g, color.b],
    glow: [emissive.r * strength, emissive.g * strength, emissive.b * strength],
    roughness: material.roughness,
    metalness: material.metalness,
  }
}

/** The vertex attributes the shared material reads, besides position, normal and colour. */
export const GLOW_ATTRIBUTE = 'glowColor'
export const SURFACE_ATTRIBUTE = 'surface'

function readPerVertex(shader: WebGLProgramParametersWithUniforms): void {
  applySkyShading(shader)
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\nattribute vec3 ${GLOW_ATTRIBUTE};\nattribute vec2 ${SURFACE_ATTRIBUTE};\nvarying vec3 vGlow;\nvarying vec2 vSurface;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvGlow = ${GLOW_ATTRIBUTE};\nvSurface = ${SURFACE_ATTRIBUTE};`)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGlow;\nvarying vec2 vSurface;')
    .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vGlow;')
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vSurface.x;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vSurface.y;')
}

let shared: MeshStandardMaterial | null = null

/** The one material every plain part is drawn with. */
export function plainMaterial(): MeshStandardMaterial {
  if (shared) return shared
  shared = new MeshStandardMaterial({ color: 0xffffff, vertexColors: true })
  shared.onBeforeCompile = readPerVertex
  shared.customProgramCacheKey = () => 'prop-plain'
  return shared
}
