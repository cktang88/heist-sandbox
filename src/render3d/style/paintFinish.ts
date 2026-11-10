import { HalfFloatType, LinearFilter, ShaderMaterial, Vector2, Vector3, WebGLRenderTarget, type Texture, type WebGLRenderer } from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { paperTexture } from './drawnTextures'
import type { PaintFinish } from './styles'

/**
 * Painted realism: an anisotropic Kuwahara filter (Kyprianidis, Kang and Döllner 2009, with the polynomial
 * sector weights of their 2010 follow-up; written here from the papers) flattens photo grain, texture noise and
 * modelling detail into brush-like patches that follow the edges, so scans, primitives and characters end up
 * as one painted surface. It runs at reduced resolution, which both keeps it affordable and makes the strokes
 * big enough to read. Then a strong split-tone grade, soft dark edges and canvas tooth at full resolution.
 *
 * Steps: downsample -> structure tensor (which way edges run) -> blur it -> Kuwahara -> full-size composite.
 */

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

const copyShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  varying vec2 vUv;
  void main() { gl_FragColor = vec4(texture2D(tDiffuse, vUv).rgb, 1.0); }`

/** Colour gradients by Sobel, stored as the structure tensor (E, F, G). */
const tensorShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 texel;
  varying vec2 vUv;
  vec3 at(float x, float y) { return texture2D(tDiffuse, vUv + vec2(x, y) * texel).rgb; }
  void main() {
    vec3 gx = (at(1.0, 1.0) + 2.0 * at(1.0, 0.0) + at(1.0, -1.0) - at(-1.0, 1.0) - 2.0 * at(-1.0, 0.0) - at(-1.0, -1.0)) * 0.25;
    vec3 gy = (at(1.0, 1.0) + 2.0 * at(0.0, 1.0) + at(-1.0, 1.0) - at(1.0, -1.0) - 2.0 * at(0.0, -1.0) - at(-1.0, -1.0)) * 0.25;
    gl_FragColor = vec4(dot(gx, gx), dot(gx, gy), dot(gy, gy), 1.0);
  }`

/** Separable Gaussian (sigma about 2 pixels) to smooth the tensor, so stroke directions flow instead of flickering. */
const blurShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 direction;
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(tDiffuse, vUv) * 0.2042;
    sum += (texture2D(tDiffuse, vUv + direction * 1.0) + texture2D(tDiffuse, vUv - direction * 1.0)) * 0.1802;
    sum += (texture2D(tDiffuse, vUv + direction * 2.0) + texture2D(tDiffuse, vUv - direction * 2.0)) * 0.1238;
    sum += (texture2D(tDiffuse, vUv + direction * 3.0) + texture2D(tDiffuse, vUv - direction * 3.0)) * 0.0663;
    sum += (texture2D(tDiffuse, vUv + direction * 4.0) + texture2D(tDiffuse, vUv - direction * 4.0)) * 0.0276;
    gl_FragColor = sum;
  }`

/**
 * The filter. An ellipse aligned with the local edge direction (longer along the edge where the image is
 * strongly oriented) is split into eight overlapping sectors; each sector's mean colour is weighted by how
 * little the colour varies inside it, so the result takes the colour of the smoothest side and edges stay sharp.
 */
const kuwaharaShader = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform sampler2D tTensor;
  uniform vec2 texel;
  uniform float radius;
  varying vec2 vUv;
  const float ALPHA = 1.0;
  const float SHARPNESS = 8.0;
  const float HARDNESS = 8.0;
  const float ZERO_CROSSING = 0.58;
  const int MAX_REACH = 12;

  void main() {
    vec3 t = texture2D(tTensor, vUv).xyz;
    float root = sqrt(max((t.x - t.z) * (t.x - t.z) + 4.0 * t.y * t.y, 0.0));
    float l1 = 0.5 * (t.x + t.z + root);
    float l2 = 0.5 * (t.x + t.z - root);
    vec2 v = vec2(l1 - t.x, -t.y);
    vec2 along = dot(v, v) > 1e-12 ? normalize(v) : vec2(0.0, 1.0);
    float phi = -atan(along.y, along.x);
    float anisotropy = l1 + l2 > 1e-8 ? (l1 - l2) / (l1 + l2) : 0.0;
    float a = radius * clamp((ALPHA + anisotropy) / ALPHA, 0.1, 2.0);
    float b = radius * clamp(ALPHA / (ALPHA + anisotropy), 0.1, 2.0);
    float c = cos(phi);
    float s = sin(phi);
    mat2 toUnit = mat2(0.5 / a, 0.0, 0.0, 0.5 / b) * mat2(c, s, -s, c);
    int reachX = min(MAX_REACH, int(sqrt(a * a * c * c + b * b * s * s)));
    int reachY = min(MAX_REACH, int(sqrt(a * a * s * s + b * b * c * c)));
    float zeta = 2.0 / radius;
    float sz = sin(ZERO_CROSSING);
    float eta = (zeta + cos(ZERO_CROSSING)) / (sz * sz);

    vec4 mean[8];
    vec3 square[8];
    for (int k = 0; k < 8; k++) { mean[k] = vec4(0.0); square[k] = vec3(0.0); }
    for (int y = -MAX_REACH; y <= MAX_REACH; y++) {
      if (y < -reachY || y > reachY) continue;
      for (int x = -MAX_REACH; x <= MAX_REACH; x++) {
        if (x < -reachX || x > reachX) continue;
        vec2 p = toUnit * vec2(float(x), float(y));
        if (dot(p, p) > 0.25) continue;
        vec3 colour = clamp(texture2D(tDiffuse, vUv + vec2(float(x), float(y)) * texel).rgb, 0.0, 1.0);
        float w[8];
        float total = 0.0;
        // Polynomial sector weights for the four axis sectors, then for the four diagonal ones.
        for (int half_ = 0; half_ < 2; half_++) {
          vec2 q = half_ == 0 ? p : 0.70710678 * vec2(p.x - p.y, p.x + p.y);
          float xx = zeta - eta * q.x * q.x;
          float yy = zeta - eta * q.y * q.y;
          float z0 = max(0.0, q.y + xx);
          float z1 = max(0.0, -q.x + yy);
          float z2 = max(0.0, -q.y + xx);
          float z3 = max(0.0, q.x + yy);
          w[half_] = z0 * z0; w[2 + half_] = z1 * z1; w[4 + half_] = z2 * z2; w[6 + half_] = z3 * z3;
          total += z0 * z0 + z1 * z1 + z2 * z2 + z3 * z3;
        }
        float g = exp(-3.125 * dot(p, p)) / max(total, 1e-8);
        for (int k = 0; k < 8; k++) {
          float wk = w[k] * g;
          mean[k] += vec4(colour * wk, wk);
          square[k] += colour * colour * wk;
        }
      }
    }
    vec4 result = vec4(0.0);
    vec3 calmest = vec3(0.0);
    float calmestVariance = 1e9;
    for (int k = 0; k < 8; k++) {
      vec3 m = mean[k].rgb / max(mean[k].w, 1e-8);
      vec3 variance = abs(square[k] / max(mean[k].w, 1e-8) - m * m);
      float spread = variance.r + variance.g + variance.b;
      float weight = 1.0 / (1.0 + pow(HARDNESS * 1000.0 * spread, 0.5 * SHARPNESS));
      result += vec4(m * weight, weight);
      if (spread < calmestVariance) { calmestVariance = spread; calmest = m; }
    }
    // Around tiny bright details (lit windows) every sector is busy and all weights vanish; then the calmest one wins.
    gl_FragColor = vec4(result.w > 1e-20 ? result.rgb / result.w : calmest, 1.0);
  }`

/** Full resolution: the painted image, a strong split-tone grade, soft dark edges, canvas weave and a still grain. */
const compositeShader = /* glsl */ `
  uniform sampler2D tPaint;
  uniform sampler2D tEdges;
  uniform sampler2D tCanvas;
  uniform vec2 resolution;
  uniform vec3 shadowTint;
  uniform vec3 highlightTint;
  uniform float edgeDarken;
  uniform float canvasAmount;
  varying vec2 vUv;
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  void main() {
    vec3 colour = texture2D(tPaint, vUv).rgb;
    float grey = luma(colour);
    colour *= mix(shadowTint, highlightTint, smoothstep(0.08, 0.7, grey));
    // A little more contrast than the photographic grade: paint states its darks and lights plainly.
    colour = (colour - 0.4) * 1.12 + 0.4;
    vec2 edges = texture2D(tEdges, vUv).rg;
    colour *= 1.0 - edgeDarken * max(edges.r, edges.g * 0.5);
    float s = resolution.y / 1080.0;
    vec2 px = gl_FragCoord.xy / max(s, 0.5);
    // Canvas tooth, strongest in the mid tones like dry-brushed paint.
    float tooth = texture2D(tCanvas, px / 512.0).r - 0.5;
    float mid = 1.0 - abs(grey * 2.0 - 1.0);
    colour *= 1.0 + tooth * canvasAmount * (0.4 + mid);
    gl_FragColor = vec4(clamp(colour, 0.0, 1.0), 1.0);
  }`

function material(fragmentShader: string, uniforms: Record<string, { value: unknown }>): ShaderMaterial {
  return new ShaderMaterial({ vertexShader: VERTEX, fragmentShader, uniforms, depthTest: false, depthWrite: false })
}

function target(): WebGLRenderTarget {
  return new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter })
}

export class PaintPass extends Pass {
  private readonly small = target()
  private readonly tensor = target()
  private readonly spare = target()
  private readonly painted = target()
  private readonly canvasTexture = paperTexture()
  private readonly copy = material(copyShader, { tDiffuse: { value: null } })
  private readonly structure = material(tensorShader, { tDiffuse: { value: null }, texel: { value: new Vector2() } })
  private readonly blur = material(blurShader, { tDiffuse: { value: null }, direction: { value: new Vector2() } })
  private readonly kuwahara = material(kuwaharaShader, { tDiffuse: { value: null }, tTensor: { value: null }, texel: { value: new Vector2() }, radius: { value: 4 } })
  private readonly composite: ShaderMaterial
  private readonly quad = new FullScreenQuad()
  private smallSize = new Vector2(1, 1)

  constructor(private readonly finish: PaintFinish, edges: Texture) {
    super()
    this.composite = material(compositeShader, {
      tPaint: { value: this.painted.texture },
      tEdges: { value: edges },
      tCanvas: { value: this.canvasTexture },
      resolution: { value: new Vector2(1, 1) },
      shadowTint: { value: new Vector3(finish.shadowTint.r, finish.shadowTint.g, finish.shadowTint.b) },
      highlightTint: { value: new Vector3(finish.highlightTint.r, finish.highlightTint.g, finish.highlightTint.b) },
      edgeDarken: { value: finish.edgeDarken },
      canvasAmount: { value: finish.canvas },
    })
  }

  setSize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width * this.finish.scale))
    const h = Math.max(1, Math.round(height * this.finish.scale))
    this.smallSize.set(w, h)
    for (const buffer of [this.small, this.tensor, this.spare, this.painted]) buffer.setSize(w, h)
    this.composite.uniforms.resolution.value.set(width, height)
    // Strokes keep the same size on screen at any resolution: the radius is set for a 360-row working image.
    this.kuwahara.uniforms.radius.value = Math.min(6, this.finish.radius * Math.max(1, h / 360))
  }

  private draw(renderer: WebGLRenderer, shader: ShaderMaterial, output: WebGLRenderTarget | null): void {
    this.quad.material = shader
    renderer.setRenderTarget(output)
    this.quad.render(renderer)
  }

  render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget): void {
    const texel = new Vector2(1 / this.smallSize.x, 1 / this.smallSize.y)
    this.copy.uniforms.tDiffuse.value = readBuffer.texture
    this.draw(renderer, this.copy, this.small)
    this.structure.uniforms.tDiffuse.value = this.small.texture
    this.structure.uniforms.texel.value.copy(texel)
    this.draw(renderer, this.structure, this.tensor)
    this.blur.uniforms.tDiffuse.value = this.tensor.texture
    this.blur.uniforms.direction.value.set(texel.x, 0)
    this.draw(renderer, this.blur, this.spare)
    this.blur.uniforms.tDiffuse.value = this.spare.texture
    this.blur.uniforms.direction.value.set(0, texel.y)
    this.draw(renderer, this.blur, this.tensor)
    this.kuwahara.uniforms.tDiffuse.value = this.small.texture
    this.kuwahara.uniforms.tTensor.value = this.tensor.texture
    this.kuwahara.uniforms.texel.value.copy(texel)
    this.draw(renderer, this.kuwahara, this.painted)
    this.draw(renderer, this.composite, this.renderToScreen ? null : writeBuffer)
  }

  dispose(): void {
    for (const buffer of [this.small, this.tensor, this.spare, this.painted]) buffer.dispose()
    for (const shader of [this.copy, this.structure, this.blur, this.kuwahara, this.composite]) shader.dispose()
    this.canvasTexture.dispose()
    this.quad.dispose()
  }
}
