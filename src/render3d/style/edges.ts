import { HalfFloatType, ShaderMaterial, Vector2, WebGLRenderTarget, type Camera, type DepthTexture, type WebGLRenderer } from 'three'
import { FullScreenQuad, Pass } from 'three/examples/jsm/postprocessing/Pass.js'

/**
 * Finds the lines an inker would draw, from the depth buffer alone, right after the scene is drawn:
 * red = outer silhouette (the nearer side of a jump in depth), green = inner crease (a bend in a surface).
 *
 * Depth only, not a second pass over the scene with normal materials: that would double thousands of draw
 * calls, and normal maps on photo scans would turn into ink noise. A flat surface has depth that changes
 * linearly across the screen, so its second difference is zero; a bend shows up as a non-zero second
 * difference. Thresholds are in world units, scaled by the world size of one pixel, so they mean the same
 * thing at any resolution.
 *
 * The result goes to its own target, because later passes overwrite the scene's depth.
 */
const EdgeShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDepth;
    uniform vec2 texel;
    uniform float cameraNear;
    uniform float cameraFar;
    uniform float orthographic;
    /** World size of one pixel at the walking lane, and the lane's distance from the camera. */
    uniform float pixelWorld;
    uniform float laneDistance;
    /** Neighbour distance in pixels: wider lines sample further out. */
    uniform float reach;
    varying vec2 vUv;

    float distanceAt(vec2 uv) {
      float depth = texture2D(tDepth, uv).x;
      if (depth >= 1.0) return cameraFar * 4.0;
      float viewZ = orthographic > 0.5 ? orthographicDepthToViewZ(depth, cameraNear, cameraFar) : perspectiveDepthToViewZ(depth, cameraNear, cameraFar);
      return -viewZ;
    }

    void main() {
      float centre = distanceAt(vUv);
      // Pixels grow with distance under perspective; lines on things far behind the building fade out.
      float size = pixelWorld * (orthographic > 0.5 ? 1.0 : centre / laneDistance);
      float silhouette = 0.0;
      vec2 offsets[8] = vec2[8](vec2(1, 0), vec2(-1, 0), vec2(0, 1), vec2(0, -1), vec2(1, 1), vec2(-1, 1), vec2(1, -1), vec2(-1, -1));
      for (int i = 0; i < 8; i++) {
        float jump = distanceAt(vUv + offsets[i] * texel * reach) - centre;
        // Diagonals count a little less, which rounds the corners of the line.
        silhouette = max(silhouette, smoothstep(0.18, 0.4, jump) * (i < 4 ? 1.0 : 0.7));
      }
      float left = distanceAt(vUv - vec2(texel.x, 0.0));
      float right = distanceAt(vUv + vec2(texel.x, 0.0));
      float down = distanceAt(vUv - vec2(0.0, texel.y));
      float up = distanceAt(vUv + vec2(0.0, texel.y));
      float bendX = abs(left + right - 2.0 * centre);
      float bendY = abs(down + up - 2.0 * centre);
      // A big first difference is a silhouette, not a bend.
      float steep = max(max(abs(left - centre), abs(right - centre)), max(abs(down - centre), abs(up - centre)));
      float crease = smoothstep(0.35, 0.9, max(bendX, bendY) / size) * (1.0 - smoothstep(0.15, 0.3, steep));
      float fade = 1.0 - smoothstep(laneDistance + 6.0, laneDistance + 25.0, centre);
      gl_FragColor = vec4(silhouette * fade, crease * fade, 0.0, 1.0);
    }`,
}

export class EdgePass extends Pass {
  readonly target = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
  private readonly material: ShaderMaterial
  private readonly quad: FullScreenQuad

  constructor(camera: Camera & { near: number; far: number }, pixelWorld: number, laneDistance: number, reach = 1) {
    super()
    this.needsSwap = false
    this.material = new ShaderMaterial({
      ...EdgeShader,
      uniforms: {
        tDepth: { value: null },
        texel: { value: new Vector2(1, 1) },
        cameraNear: { value: camera.near },
        cameraFar: { value: camera.far },
        orthographic: { value: (camera as { isOrthographicCamera?: boolean }).isOrthographicCamera ? 1 : 0 },
        pixelWorld: { value: pixelWorld },
        laneDistance: { value: laneDistance },
        reach: { value: reach },
      },
      depthTest: false,
      depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.material)
  }

  setDepth(depth: DepthTexture | null): void {
    this.material.uniforms.tDepth.value = depth
  }

  setPixelWorld(pixelWorld: number, reach: number): void {
    this.material.uniforms.pixelWorld.value = pixelWorld
    this.material.uniforms.reach.value = reach
  }

  setSize(width: number, height: number): void {
    this.target.setSize(width, height)
    this.material.uniforms.texel.value.set(1 / width, 1 / height)
  }

  render(renderer: WebGLRenderer): void {
    renderer.setRenderTarget(this.target)
    this.quad.render(renderer)
  }

  dispose(): void {
    this.target.dispose()
    this.material.dispose()
    this.quad.dispose()
  }
}
