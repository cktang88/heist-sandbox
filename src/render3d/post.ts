import { Box3, DepthTexture, HalfFloatType, Vector2, Vector3, WebGLRenderTarget, type PerspectiveCamera, type Scene, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { TimeOfDay } from '../game/site'
import { LOOKS } from './core/looks'
import type { QualityLevel } from './core/quality'

/**
 * Colour grade and lens, on the finished, tone-mapped frame (display values 0..1):
 * split toning (teal shadows, warm highlights), lift, contrast and saturation, then a soft dark edge,
 * slight colour fringing toward the corners, film grain, a red pulse on alarm and a cool cast in slow motion.
 * It runs last, after edge smoothing, so the grain stays crisp.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    slow: { value: 0 },
    alarm: { value: 0 },
    shadowTint: { value: new Vector3(1, 1, 1) },
    highlightTint: { value: new Vector3(1, 1, 1) },
    lift: { value: new Vector3() },
    saturation: { value: 1 },
    contrast: { value: 1 },
    vignette: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time; uniform float slow; uniform float alarm;
    uniform vec3 shadowTint; uniform vec3 highlightTint; uniform vec3 lift;
    uniform float saturation; uniform float contrast; uniform float vignette;
    varying vec2 vUv;
    float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 43.0) * 43758.5453); }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec2 fromCentre = vUv - 0.5;
      float fringe = dot(fromCentre, fromCentre) * (0.004 + slow * 0.012);
      vec3 colour = vec3(
        texture2D(tDiffuse, vUv + fromCentre * fringe).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - fromCentre * fringe).b);
      float grey = luma(colour);
      colour *= mix(shadowTint, highlightTint, smoothstep(0.05, 0.75, grey));
      colour += lift * (1.0 - grey) * (1.0 - grey);
      colour = (colour - 0.42) * contrast + 0.42;
      colour = mix(vec3(luma(colour)), colour, saturation);
      colour += vec3(0.07, -0.01, -0.015) * alarm * (1.0 - grey);
      colour *= 1.0 - smoothstep(0.35, 0.95, length(fromCentre)) * vignette;
      grey = luma(colour);
      colour = mix(colour, vec3(grey) * vec3(0.85, 0.97, 1.15), slow * 0.28);
      colour += (grain(vUv * 900.0) - 0.5) * 0.022 * (0.35 + grey);
      gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
    }`,
}

/** Ambient occlusion reach in world units (about 1.2 m): soft darkening into room corners, under desks and along ceilings. */
const AO_RADIUS = 1.1
/** Only the building slice gets occlusion; the far skyline and backdrop do not. */
const AO_DEPTH = { near: 2.5, far: -3.2 }
const MULTISAMPLES = 4

export type Mood = { timeOfDay: TimeOfDay; alarm: number; slow: number }

export type PostChain = {
  render(time: number): void
  setSize(width: number, height: number): void
  setQuality(level: QualityLevel): void
  /** Grade for the time of day, plus the alarm pulse (0..1) and slow-motion amount (0..1). */
  setLook(mood: Mood): void
}

/**
 * Pass order: scene (HDR, half float, optional multisampling) -> ambient occlusion -> bloom ->
 * tone mapping and sRGB (OutputPass) -> SMAA when not multisampling -> grade, lens and grain.
 */
export function createPost(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): PostChain {
  // Both composer buffers carry depth, so the occlusion pass can rebuild normals from it without
  // drawing the scene a second time.
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthTexture: new DepthTexture(1, 1) })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(new RenderPass(scene, camera))

  // Built with its own G-buffer (which it needs to exist internally), then switched to depth only:
  // the internal buffer is never drawn to, so it is never allocated.
  const ao = new GTAOPass(scene, camera, 1, 1)
  ao.setGBuffer(target.depthTexture ?? undefined)
  ao.updateGtaoMaterial({ radius: AO_RADIUS, distanceExponent: 1, thickness: 1.2, scale: 2, samples: 12, distanceFallOff: 1 })
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 })
  ao.blendIntensity = 1
  ao.setSceneClipBox(new Box3(new Vector3(-1e4, -1e4, AO_DEPTH.far), new Vector3(1e4, 1e4, AO_DEPTH.near)))
  composer.addPass(ao)

  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.5, 0.6, 1.1)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  const smaa = new SMAAPass()
  composer.addPass(smaa)
  const grade = new ShaderPass(GradeShader)
  composer.addPass(grade)

  let size = { width: 1, height: 1 }
  let level: QualityLevel | null = null

  function resizePasses(): void {
    composer.setSize(size.width, size.height)
    const bloomScale = level?.bloomScale ?? 1
    bloom.setSize(Math.max(2, size.width * bloomScale), Math.max(2, size.height * bloomScale))
  }

  return {
    render(time) {
      grade.uniforms.time.value = time % 100
      // The composer alternates its two buffers, so point the occlusion pass at whichever holds this frame's depth.
      const depth = composer.readBuffer.depthTexture
      ao.gtaoMaterial.uniforms.tDepth.value = depth
      ao.pdMaterial.uniforms.tDepth.value = depth
      composer.render()
    },
    setSize(width, height) {
      size = { width, height }
      resizePasses()
    },
    setQuality(next) {
      const samples = next.multisample ? MULTISAMPLES : 0
      if (composer.renderTarget1.samples !== samples) {
        for (const buffer of [composer.renderTarget1, composer.renderTarget2]) {
          buffer.samples = samples
          buffer.dispose()
        }
      }
      ao.enabled = next.ambientOcclusion
      smaa.enabled = !next.multisample
      level = next
      resizePasses()
    },
    setLook({ timeOfDay, alarm, slow }) {
      const look = LOOKS[timeOfDay]
      const u = grade.uniforms
      u.shadowTint.value.set(look.grade.shadowTint.r, look.grade.shadowTint.g, look.grade.shadowTint.b)
      u.highlightTint.value.set(look.grade.highlightTint.r, look.grade.highlightTint.g, look.grade.highlightTint.b)
      u.lift.value.set(look.grade.lift.r, look.grade.lift.g, look.grade.lift.b)
      u.saturation.value = look.grade.saturation
      u.contrast.value = look.grade.contrast
      u.vignette.value = look.grade.vignette
      u.alarm.value = alarm
      u.slow.value = slow
      bloom.strength = look.bloom.strength
      bloom.radius = look.bloom.radius
      bloom.threshold = look.bloom.threshold
    },
  }
}
