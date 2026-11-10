/** Shared shader snippets for the hazard effects: cheap value noise, so flames and smoke need no textures. */
export const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float total = 0.0;
    float weight = 0.5;
    for (int octave = 0; octave < 4; octave++) { total += valueNoise(p) * weight; p = p * 2.03 + 17.1; weight *= 0.5; }
    return total / 0.9375;
  }
`
