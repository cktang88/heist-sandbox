import { Color, ShaderMaterial, Vector2, type Texture } from 'three'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { labelPass } from '../core/passTimings'
import { DISPLAY_PARS, GRADE_PARS, type GradeUniforms } from './grade'
import { bakePaletteLut, LUT_SIZE } from './palette'
import type { PixelGrid, Snap } from './pixelGrid'
import type { PixelFinish } from './styles'

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

/**
 * The pixel looks' whole finish in one pass, drawn at screen size. Each screen pixel fetches its art pixel exactly
 * (an explicit nearest fetch, so no browser or texture filtering can blur it), shifted by the camera's leftover
 * sub-pixel offset so scrolling stays smooth, and works out that art pixel's colour: tone mapping and sRGB (three's
 * output step), the grade, inner creases darkened a step, an ordered dither, the palette cube, and outer silhouettes
 * inked in the darkest palette colour. The dither is counted in world-fixed art pixels, so it stays on the surfaces as
 * the view moves instead of swimming over them. One pass instead of four (output, grade, palette, upscale); the scene,
 * outlines, occlusion and bloom before it all run at the art resolution.
 */
const finishShader = /* glsl */ `
  precision highp sampler3D;
  uniform sampler2D tDiffuse;
  uniform sampler2D tEdges;
  uniform sampler3D palette;
  uniform float dither;
  uniform vec2 cell;
  uniform vec3 ink;
  uniform float silhouetteInk;
  uniform float creaseInk;
  uniform vec2 screen;
  uniform vec2 art;
  uniform float scale;
  uniform vec2 residual;
  ${DISPLAY_PARS}
  ${GRADE_PARS}
  const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  void main() {
    vec2 at = residual + (gl_FragCoord.xy - screen * 0.5) / scale + art * 0.5;
    ivec2 texel = ivec2(floor(at));
    vec3 colour = display(texelFetch(tDiffuse, texel, 0).rgb);
    colour = gradeColour(colour, (vec2(texel) + 0.5) / art - 0.5, vec2(texel));
    vec2 edges = texelFetch(tEdges, texel, 0).rg;
    colour *= 1.0 - edges.g * creaseInk;
    ivec2 p = ((texel + ivec2(cell)) % 4 + 4) % 4;
    float threshold = (BAYER[p.y * 4 + p.x] + 0.5) / 16.0 - 0.5;
    // Darker tones get a smaller nudge: palette steps are closer together there, and big dither in the dark reads as noise.
    colour += threshold * dither * (0.45 + colour);
    vec3 lookup = (clamp(colour, 0.0, 1.0) * ${LUT_SIZE - 1}.0 + 0.5) / ${LUT_SIZE}.0;
    vec3 snapped = texture(palette, lookup).rgb;
    gl_FragColor = vec4(mix(snapped, ink, step(0.5, edges.r) * silhouetteInk), 1.0);
  }`

export type PixelPasses = {
  pass: ShaderPass
  setFrame(snap: Snap): void
  setGrid(grid: PixelGrid, screenWidth: number, screenHeight: number): void
  dispose(): void
}

/** `grade` is the grade's uniforms, shared with the post chain so mood changes reach this pass. */
export function createPixelPasses(finish: PixelFinish, edges: Texture, grade: GradeUniforms): PixelPasses {
  const lut = bakePaletteLut()
  const pass = labelPass(new ShaderPass(new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: finishShader,
    uniforms: {
      ...grade,
      tDiffuse: { value: null },
      tEdges: { value: edges },
      palette: { value: lut },
      dither: { value: finish.dither },
      cell: { value: new Vector2() },
      ink: { value: new Color('#06070b') },
      silhouetteInk: { value: finish.silhouetteInk },
      creaseInk: { value: finish.creaseInk },
      screen: { value: new Vector2(1, 1) },
      art: { value: new Vector2(1, 1) },
      scale: { value: 1 },
      residual: { value: new Vector2() },
    },
  })), 'PixelFinish')
  return {
    pass,
    setFrame(snap) {
      // Whole art pixels only, kept small so float precision never runs out.
      pass.uniforms.cell.value.set(((snap.cellX % 4) + 4) % 4, ((snap.cellY % 4) + 4) % 4)
      pass.uniforms.residual.value.set(snap.residualX, snap.residualY)
    },
    setGrid(grid, screenWidth, screenHeight) {
      pass.uniforms.screen.value.set(screenWidth, screenHeight)
      pass.uniforms.art.value.set(grid.width, grid.height)
      pass.uniforms.scale.value = grid.scale
    },
    dispose() {
      lut.dispose()
      pass.dispose()
    },
  }
}
