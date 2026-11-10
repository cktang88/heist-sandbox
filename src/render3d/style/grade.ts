import { Vector3 } from 'three'

/**
 * Colour grade and lens, on the finished, tone-mapped frame (display values 0..1):
 * split toning (teal shadows, warm highlights), lift, contrast and saturation, then a soft dark edge, a red pulse on
 * alarm, a cool cast in slow motion and film grain. Shared by the grade pass of the smooth looks and the single final
 * pass of the pixel looks, which runs it per art pixel.
 */
export const GRADE_PARS = /* glsl */ `
  uniform float time; uniform float slow; uniform float alarm; uniform float lens;
  uniform vec3 shadowTint; uniform vec3 highlightTint; uniform vec3 lift;
  uniform float saturation; uniform float contrast; uniform float vignette;
  float gradeGrain(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 43.0) * 43758.5453); }
  float gradeLuma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  /** \`fromCentre\` is the screen position from the centre (-0.5..0.5); \`grainAt\` seeds the film grain. */
  vec3 gradeColour(vec3 colour, vec2 fromCentre, vec2 grainAt) {
    float grey = gradeLuma(colour);
    colour *= mix(shadowTint, highlightTint, smoothstep(0.05, 0.75, grey));
    colour += lift * (1.0 - grey) * (1.0 - grey);
    colour = (colour - 0.42) * contrast + 0.42;
    colour = mix(vec3(gradeLuma(colour)), colour, saturation);
    colour += vec3(0.07, -0.01, -0.015) * alarm * (1.0 - grey);
    colour *= 1.0 - smoothstep(0.35, 0.95, length(fromCentre)) * vignette;
    grey = gradeLuma(colour);
    colour = mix(colour, vec3(grey) * vec3(0.85, 0.97, 1.15), slow * 0.28);
    colour += (gradeGrain(grainAt) - 0.5) * 0.022 * (0.35 + grey) * lens;
    return clamp(colour, 0.0, 1.0);
  }`

export type GradeUniforms = {
  time: { value: number }
  slow: { value: number }
  alarm: { value: number }
  lens: { value: number }
  shadowTint: { value: Vector3 }
  highlightTint: { value: Vector3 }
  lift: { value: Vector3 }
  saturation: { value: number }
  contrast: { value: number }
  vignette: { value: number }
}

export function gradeUniforms(): GradeUniforms {
  return {
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
  }
}

/**
 * The grade as its own full-screen pass, with slight colour fringing toward the corners (scaled by `lens`, like the
 * grain): it runs after edge smoothing, so the grain stays crisp.
 */
export function gradeShader(): { uniforms: GradeUniforms & { tDiffuse: { value: null } }; vertexShader: string; fragmentShader: string } {
  return {
    uniforms: { tDiffuse: { value: null }, ...gradeUniforms() },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      ${GRADE_PARS}
      varying vec2 vUv;
      void main() {
        vec2 fromCentre = vUv - 0.5;
        float fringe = dot(fromCentre, fromCentre) * (0.004 + slow * 0.012) * lens;
        vec3 colour = vec3(
          texture2D(tDiffuse, vUv + fromCentre * fringe).r,
          texture2D(tDiffuse, vUv).g,
          texture2D(tDiffuse, vUv - fromCentre * fringe).b);
        gl_FragColor = vec4(gradeColour(colour, fromCentre, vUv * 900.0), 1.0);
      }`,
  }
}

/**
 * Linear scene light to display values, as three's output pass does: three defines `toneMapping()` and
 * `linearToOutputTexel()` for a material drawn straight to the screen.
 */
export const DISPLAY_PARS = /* glsl */ `
  vec3 display(vec3 c) {
    #ifdef TONE_MAPPING
      c = toneMapping(c);
    #endif
    return linearToOutputTexel(vec4(c, 1.0)).rgb;
  }`
