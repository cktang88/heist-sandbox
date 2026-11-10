import { ShaderMaterial, Vector2, type Texture } from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { hatchTexture, paperTexture } from './drawnTextures'
import type { SketchFinish } from './styles'

/**
 * The graphic-novel pencil look, on the finished, tone-mapped frame.
 *
 * Brightness picks a tone of pencil hatching (sparse diagonal strokes in half-light, cross-hatch in shadow,
 * solid charcoal in black) over a soft graphite wash on paper, so light against dark stays the first thing
 * you read. Ink lines come from the edge pass. Colour is dropped except where it means something: bright,
 * saturated pixels (lamps, neon, fire, screens, the player's goggles) keep their hue, light tints the drawing
 * it falls on, and strong reds (blood, the alarm) survive.
 *
 * Strokes are anchored to the screen and "boil": a few times a second the hatching jumps to a new offset and
 * the lines take a new wobble, like successive hand-drawn frames. Nothing changes between those moments,
 * so there is no per-frame noise.
 */
const fragmentShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tEdges;
  uniform sampler2D tHatch;
  uniform sampler2D tPaper;
  uniform vec2 resolution;
  uniform float frame;
  uniform vec3 paper;
  uniform vec3 ink;
  uniform float keepColour;
  uniform float lineWidth;
  uniform float alarm;
  uniform float slow;
  varying vec2 vUv;

  float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

  void main() {
    // Stroke sizes follow the screen height, so the drawing looks the same at any resolution.
    float s = resolution.y / 1080.0;
    vec2 px = gl_FragCoord.xy;
    vec2 jump = vec2(hash(frame), hash(frame + 7.31)) * 512.0;
    vec2 wobble = (texture2D(tPaper, px / (700.0 * s) + jump / 977.0).gb - 0.5) * 2.0;

    vec3 scene = texture2D(tDiffuse, vUv + wobble * 0.6 / resolution).rgb;
    vec2 edges = texture2D(tEdges, vUv + wobble * lineWidth * s / resolution).rg;

    // Tone on a log scale, as the eye sees it: lit rooms stay near paper, shadow is cross-hatched, and only
    // near black goes solid charcoal. This keeps light against dark readable.
    float dark = 1.0 - clamp(log2(max(luma(scene), 1e-4) / 0.03) / log2(0.65 / 0.03), 0.0, 1.0);
    vec4 strokes = texture2D(tHatch, (px + jump) / (512.0 * s));
    float hatch = strokes.r * smoothstep(0.3, 0.42, dark);
    hatch = mix(hatch, strokes.g, smoothstep(0.46, 0.58, dark));
    hatch = mix(hatch, strokes.b, smoothstep(0.6, 0.72, dark));
    hatch = mix(hatch, strokes.a, smoothstep(0.74, 0.86, dark));

    // Selective colour, measured on the scene before it becomes pencil.
    float high = max(scene.r, max(scene.g, scene.b));
    float low = min(scene.r, min(scene.g, scene.b));
    float saturation = (high - low) / max(high, 1e-3);
    vec3 hue = scene / max(high, 1e-3);
    float lit = smoothstep(0.25, 0.6, saturation) * smoothstep(0.2, 0.6, high);
    float red = smoothstep(0.35, 0.6, (scene.r - max(scene.g, scene.b)) / max(scene.r, 1e-3)) * smoothstep(0.08, 0.25, scene.r);
    float keep = max(lit, red) * keepColour;

    float tooth = texture2D(tPaper, px / (512.0 * s)).r;
    vec3 sheet = paper * (0.93 + 0.14 * (tooth - 0.5));
    // A continuous charcoal wash carries the shapes (small things such as people are smaller than the hatch
    // spacing); the hatching on top gives it the hand-drawn texture. Light tints the paper it falls on.
    vec3 wash = sheet * mix(1.0, 0.3, pow(dark, 1.3));
    wash *= mix(vec3(1.0), hue * 1.1, keep * 0.7);
    float line = max(smoothstep(0.2, 0.6, edges.r), edges.g * 0.55);
    float pencil = clamp(max(hatch * (0.6 + 0.35 * (1.0 - tooth)), line * 0.92), 0.0, 1.0);
    vec3 colour = mix(wash, ink, pencil);
    // Light sources themselves glow through the drawing in their own colour.
    float glow = smoothstep(0.75, 1.0, high) * smoothstep(0.25, 0.55, saturation) * (1.0 - line);
    colour = mix(colour, scene, glow * keepColour);

    vec2 fromCentre = vUv - 0.5;
    colour *= 1.0 - smoothstep(0.3, 0.85, length(fromCentre * vec2(1.0, 0.8))) * 0.55;
    colour = mix(colour, colour * vec3(1.35, 0.55, 0.5), alarm * 0.45);
    colour = mix(colour, vec3(luma(colour)) * vec3(0.85, 0.96, 1.12), slow * 0.4);
    colour += (hash(dot(floor(px / max(1.0, 1.5 * s)), vec2(1.0, 157.0)) + frame * 0.13) - 0.5) * 0.035;
    gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
  }`

export type SketchPass = { pass: ShaderPass; setFrame(time: number, alarm: number, slow: number): void; setSize(width: number, height: number): void; dispose(): void }

export function createSketchPass(finish: SketchFinish, edges: Texture): SketchPass {
  const hatch = hatchTexture()
  const paperTex = paperTexture()
  const pass = new ShaderPass(new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader,
    uniforms: {
      tDiffuse: { value: null },
      tEdges: { value: edges },
      tHatch: { value: hatch },
      tPaper: { value: paperTex },
      resolution: { value: new Vector2(1, 1) },
      frame: { value: 0 },
      paper: { value: finish.paper.clone() },
      ink: { value: finish.ink.clone() },
      keepColour: { value: finish.keepColour },
      lineWidth: { value: finish.lineWidth },
      alarm: { value: 0 },
      slow: { value: 0 },
    },
  }))
  return {
    pass,
    setFrame(time, alarm, slow) {
      pass.uniforms.frame.value = Math.floor(time * finish.boilRate) % 997
      pass.uniforms.alarm.value = alarm
      pass.uniforms.slow.value = slow
    },
    setSize(width, height) {
      pass.uniforms.resolution.value.set(width, height)
    },
    dispose() {
      hatch.dispose()
      paperTex.dispose()
      pass.dispose()
    },
  }
}
