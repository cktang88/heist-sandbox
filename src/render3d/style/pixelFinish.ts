import { Color, ShaderMaterial, Vector2, type Texture } from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { bakePaletteLut, LUT_SIZE } from './palette'
import type { PixelGrid, Snap } from './pixelGrid'
import type { PixelFinish } from './styles'

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

/**
 * Runs on the art-pixel target, after tone mapping and the grade: inner creases darken the colour a step,
 * an ordered dither nudges it, the palette cube snaps it to the nearest palette colour, and outer silhouettes
 * are inked in the darkest palette colour. The dither is counted in world-fixed art pixels, so it stays on
 * the surfaces as the view moves instead of swimming over them.
 */
const quantiseShader = /* glsl */ `
  precision highp sampler3D;
  uniform sampler2D tDiffuse;
  uniform sampler2D tEdges;
  uniform sampler3D palette;
  uniform float dither;
  uniform vec2 cell;
  uniform vec3 ink;
  uniform float silhouetteInk;
  uniform float creaseInk;
  varying vec2 vUv;
  const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  void main() {
    vec3 colour = clamp(texture2D(tDiffuse, vUv).rgb, 0.0, 1.0);
    vec2 edges = texture2D(tEdges, vUv).rg;
    colour *= 1.0 - edges.g * creaseInk;
    ivec2 p = ivec2(mod(gl_FragCoord.xy + cell, 4.0));
    float threshold = (BAYER[p.y * 4 + p.x] + 0.5) / 16.0 - 0.5;
    // Darker tones get a smaller nudge: palette steps are closer together there, and big dither in the dark reads as noise.
    colour += threshold * dither * (0.45 + colour);
    vec3 lookup = (clamp(colour, 0.0, 1.0) * ${LUT_SIZE - 1}.0 + 0.5) / ${LUT_SIZE}.0;
    vec3 snapped = texture(palette, lookup).rgb;
    gl_FragColor = vec4(mix(snapped, ink, step(0.5, edges.r) * silhouetteInk), 1.0);
  }`

/**
 * Stretches the art-pixel target to the screen: each art pixel becomes an exact square of `scale` screen
 * pixels (an explicit nearest fetch, so no browser or texture filtering can blur it), shifted by the
 * camera's leftover sub-pixel offset so scrolling stays smooth.
 */
const upscaleShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 screen;
  uniform vec2 art;
  uniform float scale;
  uniform vec2 residual;
  void main() {
    vec2 at = residual + (gl_FragCoord.xy - screen * 0.5) / scale + art * 0.5;
    gl_FragColor = texelFetch(tDiffuse, ivec2(floor(at)), 0);
  }`

export type PixelPasses = {
  quantise: ShaderPass
  upscale: ShaderPass
  setFrame(snap: Snap): void
  setGrid(grid: PixelGrid, screenWidth: number, screenHeight: number): void
  dispose(): void
}

export function createPixelPasses(finish: PixelFinish, edges: Texture): PixelPasses {
  const lut = bakePaletteLut()
  const quantise = new ShaderPass(new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: quantiseShader,
    uniforms: {
      tDiffuse: { value: null },
      tEdges: { value: edges },
      palette: { value: lut },
      dither: { value: finish.dither },
      cell: { value: new Vector2() },
      ink: { value: new Color('#06070b') },
      silhouetteInk: { value: finish.silhouetteInk },
      creaseInk: { value: finish.creaseInk },
    },
  }))
  const upscale = new ShaderPass(new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: upscaleShader,
    uniforms: {
      tDiffuse: { value: null },
      screen: { value: new Vector2(1, 1) },
      art: { value: new Vector2(1, 1) },
      scale: { value: 1 },
      residual: { value: new Vector2() },
    },
  }))
  return {
    quantise,
    upscale,
    setFrame(snap) {
      // Whole art pixels only, kept small so float precision never runs out.
      quantise.uniforms.cell.value.set(((snap.cellX % 4) + 4) % 4, ((snap.cellY % 4) + 4) % 4)
      upscale.uniforms.residual.value.set(snap.residualX, snap.residualY)
    },
    setGrid(grid, screenWidth, screenHeight) {
      upscale.uniforms.screen.value.set(screenWidth, screenHeight)
      upscale.uniforms.art.value.set(grid.width, grid.height)
      upscale.uniforms.scale.value = grid.scale
    },
    dispose() {
      lut.dispose()
      quantise.dispose()
      upscale.dispose()
    },
  }
}
