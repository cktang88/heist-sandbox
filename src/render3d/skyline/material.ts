import { AddEquation, CustomBlending, OneFactor, OneMinusSrcAlphaFactor, ShaderMaterial, Vector2, Vector4, type Texture } from 'three'
import { CAMERA_DISTANCE } from '../style/cameraRig'
import { regionUv, REGIONS, type Region } from './atlas'

/**
 * One shader for every backdrop quad (see cards.ts for the modes). Output is premultiplied, blended with
 * (1, 1 - alpha): pictures cover what is behind them by their alpha, lights write alpha 0 and so simply add.
 * All motion (twinkle, beacons, the train, aircraft, sweeping searchlights, drifting mist, rain) is a
 * function of one time uniform, so nothing is rebuilt per frame.
 */
const VERTEX = /* glsl */ `
  attribute vec4 tint;
  attribute vec4 extra;
  uniform float time;
  uniform vec2 span;
  uniform float laneDistance;
  uniform float wideFactor;
  varying vec2 vUv;
  varying vec4 vTint;
  varying vec4 vExtra;
  varying float vGlow;

  float glowFor(float kind, float phase, float rate) {
    if (kind < 0.5) return 1.0;
    // Twinkle: distant lights shimmer through the air, never quite still.
    if (kind < 1.5) return 0.8 + 0.2 * sin(time * (1.1 + rate * 2.3) + phase) * sin(time * (0.37 + rate) + phase * 1.7);
    // Aviation beacon: a slow soft pulse every 2.6 seconds.
    if (kind < 2.5) {
      float x = fract(time / 2.6 + phase * 0.0137);
      return 0.06 + 0.94 * smoothstep(0.0, 0.06, x) * (1.0 - smoothstep(0.12, 0.5, x));
    }
    // A failing tube: now and then a few seconds of stutter.
    if (kind < 3.5) {
      float bad = step(0.8, fract(sin(floor(time * 0.4 + phase) * 78.233) * 43758.5453));
      float n = fract(sin(floor(time * 9.0 + phase) * 12.9898) * 43758.5453);
      return mix(1.0, n < 0.4 ? 0.12 : 1.0, bad);
    }
    // Aircraft strobe.
    if (kind > 4.5) return 0.15 + 0.85 * (1.0 - smoothstep(0.0, 0.1, fract(time / 1.4 + phase * 0.01)));
    return 1.0;
  }

  void main() {
    vec3 p = position;
    vUv = uv;
    vTint = tint;
    vExtra = extra;
    vGlow = 1.0;
    if (extra.x > 0.5 && extra.x < 1.5) {
      float kind = mod(extra.z, 10.0);
      vGlow = glowFor(kind, extra.y, extra.w);
      if (kind > 3.5) {
        // Moving lights travel along the layer and wrap around its ends.
        float halfWide = (laneDistance - p.z) * wideFactor;
        float left = span.x - halfWide;
        float width = span.y - span.x + 2.0 * halfWide;
        p.x = left + mod(p.x - left + time * extra.w, width);
      }
      p.xy += uv * tint.a;
    } else if (extra.x > 1.5 && extra.x < 2.5) {
      float angle = 0.3 * sin(time * extra.z + extra.y) + 0.25 * sin(extra.y * 3.0);
      vec2 along = vec2(sin(angle), cos(angle));
      vec2 side = vec2(along.y, -along.x);
      p.xy += along * uv.y * tint.a + side * uv.x * extra.w * (0.6 + uv.y * 2.6);
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }`

const FRAGMENT = /* glsl */ `
  uniform sampler2D atlas;
  uniform vec4 mistRect;
  uniform vec4 rainRect;
  uniform float time;
  varying vec2 vUv;
  varying vec4 vTint;
  varying vec4 vExtra;
  varying float vGlow;

  float tile(vec4 rect, vec2 at) { return texture2D(atlas, rect.xy + fract(at) * rect.zw).a; }

  void main() {
    float mode = vExtra.x;
    vec4 colour;
    if (mode < 0.5) {
      // The atlas is stored premultiplied (see skyline.ts), so its colour already carries its alpha.
      vec4 texel = texture2D(atlas, vUv);
      colour = vec4(texel.rgb * vTint.rgb, texel.a) * vTint.a;
    } else if (mode < 1.5) {
      // A defocused light takes the shape of the aperture: a disc (or a hexagon) a little brighter at the rim.
      vec2 q = abs(vUv);
      float hex = step(9.5, vExtra.z);
      float d = mix(length(vUv), max(q.x * 0.866 + q.y * 0.5, q.y) * 1.07, hex);
      float edge = 1.0 - smoothstep(0.72, 1.0, d);
      float body = mix(0.72, 1.0, smoothstep(0.35, 0.9, d));
      colour = vec4(vTint.rgb * (vGlow * edge * body), 0.0);
    } else if (mode < 2.5) {
      float across = 1.0 - abs(vUv.x);
      float light = across * across * pow(1.0 - vUv.y, 0.7) * smoothstep(0.0, 0.04, vUv.y);
      colour = vec4(vTint.rgb * light, 0.0);
    } else {
      float a;
      if (vExtra.y < 0.5) {
        float slow = tile(mistRect, vUv * 0.5 + vec2(time * 0.006, 0.0));
        float fast = tile(mistRect, vUv + vec2(-time * 0.017, time * 0.003));
        a = (0.55 * slow + 0.45 * fast) * (1.0 - smoothstep(0.0, 1.0, vUv.y / vExtra.w));
      } else {
        a = tile(rainRect, vUv + vec2(time * 0.04, time * 1.7));
      }
      a *= vTint.a;
      colour = vec4(vTint.rgb * a, a);
    }
    gl_FragColor = colour;
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

function rect(region: Region): Vector4 {
  const { u0, v0, u1, v1 } = regionUv(region)
  return new Vector4(u0, v0, u1 - u0, v1 - v0)
}

/** `span` is the camera's travel along the level (its left- and rightmost centre), which moving lights wrap to. */
export function createBackdropMaterial(atlas: Texture, span: [number, number], wideFactor: number): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      atlas: { value: atlas },
      time: { value: 0 },
      span: { value: new Vector2(span[0], span[1]) },
      laneDistance: { value: CAMERA_DISTANCE },
      wideFactor: { value: wideFactor },
      mistRect: { value: rect(REGIONS.mist) },
      rainRect: { value: rect(REGIONS.rain) },
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
