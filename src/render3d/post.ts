import { Box3, DepthTexture, HalfFloatType, Vector2, Vector3, WebGLRenderTarget, type Scene, type WebGLRenderer } from 'three'
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
import { TILES_TALL, CAMERA_DISTANCE, type CameraRig } from './style/cameraRig'
import { EdgePass } from './style/edges'
import { LayeredRenderPass } from './style/layeredRenderPass'
import { PaintPass } from './style/paintFinish'
import { createPixelPasses, type PixelPasses } from './style/pixelFinish'
import type { PixelGrid, Snap } from './style/pixelGrid'
import { createSketchPass, type SketchPass } from './style/sketchFinish'
import type { Style } from './style/styles'

/**
 * Colour grade and lens, on the finished, tone-mapped frame (display values 0..1):
 * split toning (teal shadows, warm highlights), lift, contrast and saturation, then a soft dark edge,
 * slight colour fringing toward the corners, film grain, a red pulse on alarm and a cool cast in slow motion.
 * It runs after edge smoothing, so the grain stays crisp. `lens` scales fringing and grain: art styles with
 * their own surface texture (pixels, pencil, paint) turn them off.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    slow: { value: 0 },
    alarm: { value: 0 },
    lens: { value: 1 },
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
    uniform sampler2D tDiffuse; uniform float time; uniform float slow; uniform float alarm; uniform float lens;
    uniform vec3 shadowTint; uniform vec3 highlightTint; uniform vec3 lift;
    uniform float saturation; uniform float contrast; uniform float vignette;
    varying vec2 vUv;
    float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 43.0) * 43758.5453); }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec2 fromCentre = vUv - 0.5;
      float fringe = dot(fromCentre, fromCentre) * (0.004 + slow * 0.012) * lens;
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
      colour += (grain(vUv * 900.0) - 0.5) * 0.022 * (0.35 + grey) * lens;
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
  /**
   * `width` x `height` is the canvas drawing size. Without a grid the whole chain runs at that size; with one
   * (pixel look) everything but the final upscale runs on the grid's art pixels.
   */
  setSize(width: number, height: number, grid: PixelGrid | null): void
  setQuality(level: QualityLevel): void
  /** Grade for the time of day, plus the alarm pulse (0..1) and slow-motion amount (0..1). */
  setLook(mood: Mood): void
  /** Where the snapped camera ended up this frame (pixel look only). */
  setSnap(snap: Snap | null): void
  dispose(): void
}

/** The look-specific passes after the shared grade. */
type Finisher = {
  setSize(width: number, height: number, screenWidth: number, screenHeight: number, grid: PixelGrid | null): void
  frame(time: number, mood: Mood, snap: Snap | null): void
  dispose(): void
}

function addFinish(composer: EffectComposer, style: Style, edges: EdgePass | null): Finisher {
  const finish = style.finish
  if (finish.kind === 'pixel' && edges) {
    const passes: PixelPasses = createPixelPasses(finish, edges.target.texture)
    composer.addPass(passes.quantise)
    composer.addPass(passes.upscale)
    return {
      setSize(_w, _h, screenWidth, screenHeight, grid) {
        if (grid) passes.setGrid(grid, screenWidth, screenHeight)
      },
      frame(_time, _mood, snap) {
        if (snap) passes.setFrame(snap)
      },
      dispose: () => passes.dispose(),
    }
  }
  if (finish.kind === 'sketch' && edges) {
    const sketch: SketchPass = createSketchPass(finish, edges.target.texture)
    composer.addPass(sketch.pass)
    return {
      setSize: (width, height) => sketch.setSize(width, height),
      frame: (time, mood) => sketch.setFrame(time, mood.alarm, mood.slow, mood.timeOfDay === 'night' ? 1 : 0),
      dispose: () => sketch.dispose(),
    }
  }
  if (finish.kind === 'paint' && edges) {
    const paint = new PaintPass(finish, edges.target.texture)
    composer.addPass(paint)
    return { setSize() {}, frame() {}, dispose: () => paint.dispose() }
  }
  return { setSize() {}, frame() {}, dispose() {} }
}

/**
 * Pass order: scene (HDR, half float, optional multisampling) -> line finding (styled looks) -> ambient
 * occlusion -> bloom -> tone mapping and sRGB (OutputPass) -> SMAA when not multisampling (smooth looks only)
 * -> grade -> the style's finish (palette and upscale, pencil, or paint).
 */
export function createPost(renderer: WebGLRenderer, scene: Scene, cameras: CameraRig, style: Style): PostChain {
  const pixel = style.finish.kind === 'pixel'
  const camera = style.camera === 'ortho' ? cameras.orthographic : cameras.perspective
  // Both composer buffers carry depth, so the occlusion pass can rebuild normals from it without
  // drawing the scene a second time.
  const target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthTexture: new DepthTexture(1, 1) })
  const composer = new EffectComposer(renderer, target)
  composer.addPass(style.camera === 'ortho' ? new LayeredRenderPass(scene, cameras.perspective, cameras.orthographic) : new RenderPass(scene, camera))

  const edges = style.finish.kind === 'real' ? null : new EdgePass(camera, TILES_TALL / 720, CAMERA_DISTANCE, pixel ? [0.6, 1.0] : [0.18, 0.4])
  if (edges) composer.addPass(edges)

  // Built with its own G-buffer (which it needs to exist internally), then switched to depth only:
  // the internal buffer is never drawn to, so it is never allocated.
  const ao = new GTAOPass(scene, camera, 1, 1)
  ao.setGBuffer(target.depthTexture ?? undefined)
  ao.updateGtaoMaterial({ radius: AO_RADIUS, distanceExponent: 1, thickness: 1.2, scale: 2, samples: 12, distanceFallOff: 1 })
  ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: pixel ? 3 : 6, rings: 2, samples: 12 })
  ao.blendIntensity = 1
  ao.setSceneClipBox(new Box3(new Vector3(-1e4, -1e4, AO_DEPTH.far), new Vector3(1e4, 1e4, AO_DEPTH.near)))
  composer.addPass(ao)

  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.5, 0.6, 1.1)
  composer.addPass(bloom)
  composer.addPass(new OutputPass())
  // Edge smoothing only where edges are meant to be smooth: pixels are hard by design and paint smooths its own.
  const smaa = style.finish.kind === 'real' || style.finish.kind === 'sketch' ? new SMAAPass() : null
  if (smaa) composer.addPass(smaa)
  const grade = new ShaderPass(GradeShader)
  grade.uniforms.lens.value = style.lens
  composer.addPass(grade)
  const finisher = addFinish(composer, style, edges)

  let size = { width: 1, height: 1, screenWidth: 1, screenHeight: 1 }
  let grid: PixelGrid | null = null
  let level: QualityLevel | null = null
  let mood: Mood = { timeOfDay: 'night', alarm: 0, slow: 0 }
  let snap: Snap | null = null

  function resizePasses(): void {
    composer.setSize(size.width, size.height)
    const bloomScale = level?.bloomScale ?? 1
    // The pixel look's buffer is already small; its bloom runs at full art resolution so glows keep their shape.
    const bloomSize = pixel ? 1 : bloomScale
    bloom.setSize(Math.max(2, size.width * bloomSize), Math.max(2, size.height * bloomSize))
    // Line thresholds use the world size of one pixel at the walking lane.
    const lineReach = style.finish.kind === 'sketch' ? Math.max(1, (style.finish.lineWidth * size.height) / 1080 * 0.6) : style.finish.kind === 'paint' ? Math.max(1, size.height / 900) : 1
    edges?.setPixelWorld(grid ? grid.unit : TILES_TALL / size.height, lineReach)
    finisher.setSize(size.width, size.height, size.screenWidth, size.screenHeight, grid)
  }

  return {
    render(time) {
      grade.uniforms.time.value = time % 100
      // The composer alternates its two buffers, so point the depth readers at whichever holds this frame's depth.
      const depth = composer.readBuffer.depthTexture
      ao.gtaoMaterial.uniforms.tDepth.value = depth
      ao.pdMaterial.uniforms.tDepth.value = depth
      edges?.setScene(composer.readBuffer)
      finisher.frame(time, mood, snap)
      composer.render()
    },
    setSize(width, height, nextGrid) {
      grid = pixel ? nextGrid : null
      size = grid ? { width: grid.width, height: grid.height, screenWidth: width, screenHeight: height } : { width, height, screenWidth: width, screenHeight: height }
      resizePasses()
    },
    setQuality(next) {
      // Multisampling would blur the art pixels, which are hard-edged on purpose.
      const samples = next.multisample && !pixel ? MULTISAMPLES : 0
      if (composer.renderTarget1.samples !== samples) {
        for (const buffer of [composer.renderTarget1, composer.renderTarget2]) {
          buffer.samples = samples
          buffer.dispose()
        }
      }
      ao.enabled = next.ambientOcclusion
      if (smaa) smaa.enabled = !next.multisample
      level = next
      resizePasses()
    },
    setLook(next) {
      mood = next
      const look = LOOKS[next.timeOfDay]
      const u = grade.uniforms
      u.shadowTint.value.set(look.grade.shadowTint.r, look.grade.shadowTint.g, look.grade.shadowTint.b)
      u.highlightTint.value.set(look.grade.highlightTint.r, look.grade.highlightTint.g, look.grade.highlightTint.b)
      u.lift.value.set(look.grade.lift.r, look.grade.lift.g, look.grade.lift.b)
      u.saturation.value = look.grade.saturation
      u.contrast.value = look.grade.contrast
      u.vignette.value = look.grade.vignette
      u.alarm.value = next.alarm
      u.slow.value = next.slow
      bloom.strength = look.bloom.strength
      bloom.radius = look.bloom.radius
      bloom.threshold = look.bloom.threshold
    },
    setSnap(next) {
      snap = next
    },
    dispose() {
      finisher.dispose()
      edges?.dispose()
      ao.dispose()
      bloom.dispose()
      smaa?.dispose()
      grade.dispose()
      composer.dispose()
      target.dispose()
    },
  }
}
