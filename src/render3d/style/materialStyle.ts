import { Color, MeshStandardMaterial, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three'
import { NEUTRAL_SURFACE, type SurfaceStyle } from './styles'

/**
 * Material-side unification. A filter over the finished frame cannot make a photo scan and a flat-coloured
 * box look like the same thing, so every standard (and physical) material gets the same few lines added
 * to its shader: albedo squeezed into one value and saturation band and pulled toward one colour ramp,
 * photo normal maps flattened, roughness squeezed, reflections capped.
 *
 * All of it is driven by shared uniforms, so switching looks never rebuilds a shader, and the neutral values
 * reproduce the material exactly as authored.
 *
 * How it reaches materials made in files this module does not own: `onBeforeCompile` on the standard material
 * prototype becomes a property whose getter wraps whatever hook is stored (the shared sky-shading hook, or a
 * material's own, such as the per-vertex finish on characters) with the style patch. A material that sets its
 * own hook is caught by the setter, so it keeps its hook and still gets the style. This must be installed
 * before any such material is created, which is why the renderer imports this module before anything else.
 */

const uniforms = {
  styleValueMin: { value: 0 },
  styleValueMax: { value: 1 },
  styleSaturationMax: { value: 1 },
  styleRampPull: { value: 0 },
  styleRampDark: { value: new Color() },
  styleRampLight: { value: new Color(1, 1, 1) },
  styleNormalDetail: { value: 1 },
  styleRoughnessMin: { value: 0 },
  styleRoughnessMax: { value: 1 },
  styleReflections: { value: 1 },
}

const HEADER = /* glsl */ `
uniform float styleValueMin;
uniform float styleValueMax;
uniform float styleSaturationMax;
uniform float styleRampPull;
uniform vec3 styleRampDark;
uniform vec3 styleRampLight;
uniform float styleNormalDetail;
uniform float styleRoughnessMin;
uniform float styleRoughnessMax;
uniform float styleReflections;
float styleLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 styleAlbedo(vec3 c) {
  float l = styleLuma(c);
  float target = clamp(l, styleValueMin, styleValueMax);
  c = l > 1e-4 ? c * (target / l) : vec3(target);
  float high = max(c.r, max(c.g, c.b));
  float saturation = high > 1e-4 ? (high - min(c.r, min(c.g, c.b))) / high : 0.0;
  if (saturation > styleSaturationMax) c = mix(vec3(target), c, styleSaturationMax / saturation);
  vec3 ramp = mix(styleRampDark, styleRampLight, smoothstep(styleValueMin, styleValueMax, target));
  ramp *= target / max(styleLuma(ramp), 1e-4);
  return mix(c, ramp, styleRampPull);
}
`

function patch(shader: WebGLProgramParametersWithUniforms): void {
  Object.assign(shader.uniforms, uniforms)
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\n${HEADER}`)
    .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = styleAlbedo(diffuseColor.rgb);')
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(mix(nonPerturbedNormal, normal, styleNormalDetail));')
    .replace('#include <lights_physical_fragment>', 'roughnessFactor = clamp(roughnessFactor, styleRoughnessMin, styleRoughnessMax);\n#include <lights_physical_fragment>')
    .replace('#include <lights_fragment_end>', 'radiance *= styleReflections;\n#include <lights_fragment_end>')
}

type Hook = (shader: WebGLProgramParametersWithUniforms, renderer: WebGLRenderer) => void
const BASE = Symbol('styleBaseHook')
type Hooked = MeshStandardMaterial & { [BASE]?: Hook }
const wrapped = new WeakMap<Hook, Hook>()

function styled(base: Hook | undefined): Hook {
  if (!base) return patch
  let hook = wrapped.get(base)
  if (!hook) {
    hook = function (this: MeshStandardMaterial, shader, renderer) {
      base.call(this, shader, renderer)
      patch(shader)
    }
    wrapped.set(base, hook)
  }
  return hook
}

let installed = false

/** Idempotent. Call before any standard material with its own `onBeforeCompile` is created. */
export function installMaterialStyle(): void {
  if (installed) return
  installed = true
  const proto = MeshStandardMaterial.prototype as Hooked
  const existing = proto.onBeforeCompile
  Object.defineProperty(proto, 'onBeforeCompile', {
    configurable: true,
    get(this: Hooked) {
      return styled(this[BASE])
    },
    set(this: Hooked, hook: Hook) {
      this[BASE] = hook
    },
  })
  // The base Material hook is an empty method; only keep a real one.
  if (existing !== Object.getPrototypeOf(proto).onBeforeCompile) proto[BASE] = existing
  // Three caches programs by this key, which defaults to the hook's source text. Every wrapper has the same
  // text, so key on the wrapped hook instead, or materials with different hooks would share one program.
  proto.customProgramCacheKey = function (this: Hooked) {
    return `${String(this[BASE] ?? '')}|style`
  }
}

/** Sets the material-side look for every standard material at once. */
export function setSurfaceStyle(style: SurfaceStyle = NEUTRAL_SURFACE): void {
  uniforms.styleValueMin.value = style.valueMin
  uniforms.styleValueMax.value = style.valueMax
  uniforms.styleSaturationMax.value = style.saturationMax
  uniforms.styleRampPull.value = style.rampPull
  uniforms.styleRampDark.value.copy(style.rampDark)
  uniforms.styleRampLight.value.copy(style.rampLight)
  uniforms.styleNormalDetail.value = style.normalDetail
  uniforms.styleRoughnessMin.value = style.roughnessMin
  uniforms.styleRoughnessMax.value = style.roughnessMax
  uniforms.styleReflections.value = style.reflections
}

installMaterialStyle()
