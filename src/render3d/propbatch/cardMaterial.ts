import { MeshStandardMaterial, ShaderChunk, type Texture, type WebGLProgramParametersWithUniforms } from 'three'
import { applySkyShading } from '../core/skyShading'
import { GLOW_RANGE, type CardPage } from './cardAtlas'

/**
 * How cards are drawn: an ordinary lit standard material on a camera-facing quad, reading everything else from the
 * atlas page. Per instance, `cardRect` picks the card's rectangle on the page (u swapped for a mirrored prop) and
 * `cardDepth` says how deep the card's model was. Each pixel then lights with the baked normal at the baked depth and
 * writes that depth, so lamps, the outline pass and anything standing among the furniture see the shape the 3D model
 * had. Cut-out by coverage (alpha test), never blended, so depth stays right. One shader for every page.
 */

export const CARD_RECT = 'cardRect'
export const CARD_DEPTH = 'cardDepth'

const VERTEX_HEADER = /* glsl */ `
attribute vec4 ${CARD_RECT};
attribute float ${CARD_DEPTH};
varying float vCardDepth;
varying float vCardMirror;`

const FRAGMENT_HEADER = /* glsl */ `
uniform sampler2D cardNormals;
uniform mat4 projectionMatrix;
varying float vCardDepth;
varying float vCardMirror;`

function cardShader(this: MeshStandardMaterial, shader: WebGLProgramParametersWithUniforms): void {
  applySkyShading(shader)
  shader.uniforms.cardNormals = { value: (this.userData as { normals: Texture }).normals }
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', `#include <common>\n${VERTEX_HEADER}`)
    .replace('#include <uv_vertex>', /* glsl */ `#include <uv_vertex>
      vMapUv = mix(${CARD_RECT}.xy, ${CARD_RECT}.zw, uv);
      vEmissiveMapUv = vMapUv;
      vCardDepth = ${CARD_DEPTH};
      vCardMirror = ${CARD_RECT}.z < ${CARD_RECT}.x ? -1.0 : 1.0;`)
  const lightsBegin = ShaderChunk.lights_fragment_begin.replace(
    'vec3 geometryPosition = - vViewPosition;',
    'vec3 geometryPosition = - vViewPosition - vec3(0.0, 0.0, cardSurface.b * vCardDepth);',
  )
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${FRAGMENT_HEADER}`)
    .replace('#include <clipping_planes_fragment>', /* glsl */ `#include <clipping_planes_fragment>
      vec4 cardSurface = texture2D(cardNormals, vMapUv);
      vec4 cardGlow = texture2D(emissiveMap, vEmissiveMapUv);`)
    .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = cardGlow.a;')
    .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = cardSurface.a;')
    .replace('#include <emissivemap_fragment>', `totalEmissiveRadiance = cardGlow.rgb * ${GLOW_RANGE.toFixed(1)};`)
    // Kept after the look's own normal flattening (added right after this include), which is meant for normal maps.
    .replace('#include <normal_fragment_maps>', /* glsl */ `#include <normal_fragment_maps>
      vec2 cardTilt = (cardSurface.xy * 2.0 - 1.0) * vec2(vCardMirror, 1.0);
      normal = vec3(cardTilt, sqrt(max(1.0 - dot(cardTilt, cardTilt), 0.0)));`)
    .replace('#include <lights_fragment_begin>', lightsBegin)
    .replace('#include <dithering_fragment>', /* glsl */ `#include <dithering_fragment>
      vec4 cardClip = projectionMatrix * vec4(-vViewPosition.xy, -vViewPosition.z - cardSurface.b * vCardDepth, 1.0);
      gl_FragDepth = cardClip.z / cardClip.w * 0.5 + 0.5;`)
}

const materials = new Map<CardPage, MeshStandardMaterial>()

/** The material for cards on `page`, made once. */
export function cardMaterial(page: CardPage): MeshStandardMaterial {
  const known = materials.get(page)
  if (known) return known
  const material = new MeshStandardMaterial({ map: page.albedo, emissiveMap: page.glow, emissive: 0xffffff, alphaTest: 0.5 })
  material.userData.normals = page.normal
  material.onBeforeCompile = cardShader
  materials.set(page, material)
  return material
}
