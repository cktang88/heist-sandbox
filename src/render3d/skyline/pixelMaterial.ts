import { AddEquation, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, Vector2, type Texture } from 'three'
import { CAMERA_DISTANCE } from '../style/cameraRig'
import { TABLE_ROWS } from './pixelPalette'

/**
 * The shader of the pixel backdrop. Every quad is snapped to whole art pixels before it is drawn, so a
 * layer drifts across the screen in clean one-pixel steps (the parallax of a pixel-art game) and its texels,
 * one per art pixel, never smear. Colours come from palette indices through the colour table (see
 * pixelPalette.ts), picked by how strongly the vignette will darken this spot of the screen.
 *
 * `extra.x` is the mode: 0 a picture of the atlas, 1 a flat ink, 2 the sky (drawn here from a few numbers),
 * 3 an out-of-focus light, 4 rain.
 */
export const PIXEL_MODE = { card: 0, flat: 1, sky: 2, light: 3, rain: 4 } as const

/** Most sky bands a mood may have. */
export const MAX_BANDS = 8

const VERTEX = /* glsl */ `
  attribute vec4 extra;
  attribute vec4 inks;
  uniform float time;
  uniform vec2 artSize;
  uniform vec2 span;
  uniform float laneDistance;
  uniform float wideFactor;
  varying vec2 vUv;
  varying vec4 vExtra;
  varying vec4 vInks;
  varying float vGlow;

  float glowFor(float kind, float phase, float rate) {
    if (kind < 0.5) return 1.0;
    if (kind < 1.5) return 0.8 + 0.2 * sin(time * (1.1 + rate * 2.3) + phase) * sin(time * (0.37 + rate) + phase * 1.7);
    if (kind < 2.5) {
      float x = fract(time / 2.6 + phase * 0.0137);
      return step(x, 0.3);
    }
    if (kind < 3.5) {
      float bad = step(0.8, fract(sin(floor(time * 0.4 + phase) * 78.233) * 43758.5453));
      float n = fract(sin(floor(time * 9.0 + phase) * 12.9898) * 43758.5453);
      return mix(1.0, n < 0.4 ? 0.0 : 1.0, bad);
    }
    if (kind > 4.5) return step(fract(time / 1.4 + phase * 0.01), 0.12);
    return 1.0;
  }

  vec2 toPixels(vec4 clip) { return (clip.xy / clip.w * 0.5 + 0.5) * artSize; }
  vec4 fromPixels(vec2 pixels, vec4 clip) { return vec4((pixels / artSize * 2.0 - 1.0) * clip.w, clip.zw); }

  void main() {
    vec3 p = position;
    vUv = uv;
    vExtra = extra;
    vInks = inks;
    vGlow = 1.0;
    float mode = extra.x;
    if (mode > 2.5 && mode < 3.5) {
      float kind = mod(extra.z, 10.0);
      vGlow = glowFor(kind, extra.y, extra.w);
      if (kind > 3.5) {
        float halfWide = (laneDistance - p.z) * wideFactor;
        float left = span.x - halfWide;
        float width = span.y - span.x + 2.0 * halfWide;
        p.x = left + mod(p.x - left + time * extra.w, width);
      }
      // The centre on a pixel centre (odd sizes) or corner (even), the corners a whole number of pixels out.
      vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      float size = inks.z;
      vec2 centre = mod(size, 2.0) > 0.5 ? floor(toPixels(clip)) + 0.5 : floor(toPixels(clip) + 0.5);
      gl_Position = fromPixels(centre + uv * size * 0.5, clip);
      return;
    }
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    gl_Position = fromPixels(floor(toPixels(clip) + 0.5), clip);
  }`

const FRAGMENT = /* glsl */ `
  uniform sampler2D atlas;
  uniform sampler2D table;
  uniform vec2 artSize;
  uniform float vignette;
  uniform float corner;
  uniform float time;
  uniform float bandStart[${MAX_BANDS}];
  uniform float bandInk[${MAX_BANDS}];
  uniform int bandCount;
  uniform vec4 stars;
  uniform vec4 disc;
  uniform vec3 discInks;
  uniform vec4 clouds;
  uniform vec2 cloudInks;
  uniform float rainInk;
  varying vec2 vUv;
  varying vec4 vExtra;
  varying vec4 vInks;
  varying float vGlow;

  const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  float bayer(vec2 p) { ivec2 i = ivec2(mod(p, 4.0)); return (BAYER[i.y * 4 + i.x] + 0.5) / 16.0; }
  // An integer hash: the sine trick clumps at the large texel coordinates of the sky.
  float hash(vec2 p) {
    uvec2 q = uvec2(ivec2(p) + 65536);
    uint h = (q.x * 1597334677u) ^ (q.y * 3812015801u);
    h = (h ^ (h >> 16u)) * 2246822519u;
    h ^= h >> 13u;
    return float(h) / 4294967295.0;
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  /** The scene colour that lands on palette colour \`ink\` here, after tone mapping, grade and vignette. */
  vec3 colourOf(float ink) {
    vec2 screen = gl_FragCoord.xy / artSize - 0.5;
    float k = 1.0 - smoothstep(0.35, 0.95, length(screen)) * vignette;
    float row = clamp((1.0 - k) / max(1e-4, 1.0 - corner), 0.0, 1.0) * ${TABLE_ROWS - 1}.0;
    // The nearest row, never a blend: a blend of two rows can fall between two palette colours.
    return texelFetch(table, ivec2(int(ink + 0.5), int(row + 0.5)), 0).rgb;
  }

  bool cloudAt(vec2 p) {
    float y = p.y;
    float envelope = smoothstep(clouds.x, clouds.x + 30.0, y) * (1.0 - smoothstep(clouds.y - 40.0, clouds.y, y));
    vec2 q = vec2(p.x + floor(time * 0.4), p.y);
    float n = 0.65 * noise(q / vec2(46.0, 9.0)) + 0.35 * noise(q / vec2(17.0, 4.0) + 31.0);
    return n * envelope > 1.0 - clouds.z * 0.62;
  }

  float skyInk(vec2 p) {
    float ink = bandInk[0];
    for (int i = 0; i < ${MAX_BANDS}; i++) {
      if (i >= bandCount) break;
      // Bands are listed highest first; the first one this row reaches wins, with a short ordered-dither
      // edge below it (four rows from 75% down to 25%) so the steps read as soft but stay clean.
      float below = bandStart[i] - p.y;
      if (below <= 0.0) { ink = bandInk[i]; break; }
      if (below <= 4.0 && bayer(p) < (5.0 - below) / 5.0) { ink = bandInk[i]; break; }
    }
    if (disc.z > 0.0) {
      float d = length(p + 0.5 - disc.xy);
      if (d < disc.z - 1.0) return discInks.x;
      if (d < disc.z) return discInks.y;
      if (d < disc.z * disc.w) return discInks.z;
    }
    if (clouds.z > 0.0 && cloudAt(p)) {
      bool edge = clouds.w > 0.5 ? !cloudAt(p - vec2(0.0, 2.0)) : !cloudAt(p + vec2(0.0, 1.0));
      return edge ? cloudInks.y : cloudInks.x;
    }
    if (stars.w > 0.0 && p.y > stars.x) {
      float h = hash(p);
      if (h < stars.w) return h < stars.w * 0.2 ? stars.z : stars.y;
    }
    return ink;
  }

  void main() {
    float mode = vExtra.x;
    float ink;
    if (mode < 0.5) {
      vec4 texel = texture2D(atlas, vUv);
      if (texel.a < 0.5) discard;
      ink = floor(texel.r * 255.0 + 0.5);
    } else if (mode < 1.5) {
      ink = vInks.x;
    } else if (mode < 2.5) {
      ink = skyInk(floor(vUv));
    } else if (mode < 3.5) {
      if (vGlow < 0.5) discard;
      vec2 q = abs(vUv * vInks.z * 0.5);
      float radius = vInks.z * 0.5;
      float d = vExtra.z > 9.5 ? max(q.x * 0.866 + q.y * 0.5, q.y) * 1.08 : length(q);
      if (d > radius - 0.1) discard;
      bool rim = d > radius - 1.1 || vGlow < 0.68;
      ink = rim ? vInks.y : vInks.x;
    } else {
      vec2 p = floor(gl_FragCoord.xy);
      float column = hash(vec2(p.x, 7.0));
      if (column > 0.22) discard;
      float fall = fract((p.y + time * (70.0 + column * 160.0) + column * 997.0) / (23.0 + column * 40.0));
      if (fall > 0.12) discard;
      ink = rainInk;
    }
    gl_FragColor = vec4(colourOf(ink), 1.0);
  }`

export type PixelMaterialOptions = {
  atlas: Texture
  table: Texture
  vignette: number
  corner: number
  span: [number, number]
  wideFactor: number
}

export function createPixelMaterial(options: PixelMaterialOptions): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      atlas: { value: options.atlas },
      table: { value: options.table },
      artSize: { value: new Vector2(640, 360) },
      vignette: { value: options.vignette },
      corner: { value: options.corner },
      time: { value: 0 },
      span: { value: new Vector2(options.span[0], options.span[1]) },
      laneDistance: { value: CAMERA_DISTANCE },
      wideFactor: { value: options.wideFactor },
      bandStart: { value: new Array<number>(MAX_BANDS).fill(-1e6) },
      bandInk: { value: new Array<number>(MAX_BANDS).fill(0) },
      bandCount: { value: 0 },
      stars: { value: [0, 0, 0, 0] },
      disc: { value: [0, 0, 0, 0] },
      discInks: { value: [0, 0, 0] },
      clouds: { value: [0, 0, 0, 0] },
      cloudInks: { value: [0, 0] },
      rainInk: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    fog: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
  })
}
