import { Vector2, type Camera as ThreeCamera, type Scene, type WebGLRenderer } from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

/** Lens effects applied to the finished frame: a soft dark edge, film grain, and a cool tint in slow motion. */
const LensShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, slow: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time; uniform float slow; varying vec2 vUv;
    float grain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 43.0) * 43758.5453); }
    void main() {
      vec2 fromCentre = vUv - 0.5;
      // Slight colour fringing toward the corners, like a real lens. Stronger in slow motion.
      float fringe = dot(fromCentre, fromCentre) * (0.004 + slow * 0.012);
      vec3 colour = vec3(
        texture2D(tDiffuse, vUv + fromCentre * fringe).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - fromCentre * fringe).b);
      colour *= 1.0 - smoothstep(0.35, 0.95, length(fromCentre)) * 0.55;
      float grey = dot(colour, vec3(0.299, 0.587, 0.114));
      colour = mix(colour, vec3(grey) * vec3(0.85, 0.97, 1.15), slow * 0.28);
      colour += (grain(vUv * 900.0) - 0.5) * 0.018 * (0.4 + grey);
      gl_FragColor = vec4(max(colour, 0.0), 1.0);
    }`,
}

export type PostChain = { render(time: number, slow: number): void; setSize(width: number, height: number): void }

/** Scene -> glow around bright things -> lens effects -> film-style tone mapping. */
export function createPost(renderer: WebGLRenderer, scene: Scene, camera: ThreeCamera): PostChain {
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 0.4, 0.55, 1.4)
  composer.addPass(bloom)
  const lens = new ShaderPass(LensShader)
  composer.addPass(lens)
  composer.addPass(new OutputPass())
  return {
    render(time, slow) {
      lens.uniforms.time.value = time % 100
      lens.uniforms.slow.value = slow
      composer.render()
    },
    setSize(width, height) {
      composer.setSize(width, height)
    },
  }
}
