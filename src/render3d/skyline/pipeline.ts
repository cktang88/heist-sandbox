import { LOOKS } from '../core/looks'
import type { TimeOfDay } from '../../game/site'

/**
 * A copy, in plain numbers, of what the frame does to a colour after the backdrop writes it: exposure and
 * tone mapping (ACES at night, AgX by day, as three.js does them), the sRGB curve, then the shared colour
 * grade of post.ts (taken at the centre of the screen, where the vignette is nil). The pixel look snaps the
 * result to its palette; running this backwards tells the backdrop which colour to write so that a pixel
 * lands squarely on the palette colour it was designed with, instead of between two of them, where the
 * ordered dither turns it into noise.
 */

export type Vec3 = [number, number, number]

type Mat3 = readonly [Vec3, Vec3, Vec3]

/** Matrices are given as three.js writes them in GLSL: three columns. */
function apply(columns: Mat3, v: Vec3): Vec3 {
  const [a, b, c] = columns
  return [a[0] * v[0] + b[0] * v[1] + c[0] * v[2], a[1] * v[0] + b[1] * v[1] + c[1] * v[2], a[2] * v[0] + b[2] * v[1] + c[2] * v[2]]
}

const ACES_IN: Mat3 = [[0.59719, 0.076, 0.0284], [0.35458, 0.90834, 0.13383], [0.04823, 0.01566, 0.83777]]
const ACES_OUT: Mat3 = [[1.60475, -0.10208, -0.00327], [-0.53108, 1.10813, -0.07276], [-0.07367, -0.00605, 1.07602]]
const REC2020_TO_SRGB: Mat3 = [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]]
const SRGB_TO_REC2020: Mat3 = [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.088], [0.0433, 0.0113, 0.8956]]
const AGX_INSET: Mat3 = [
  [0.856627153315983, 0.137318972929847, 0.11189821299995],
  [0.0951212405381588, 0.761241990602591, 0.0767994186031903],
  [0.0482516061458583, 0.101439036467562, 0.811302368396859],
]
const AGX_OUTSET: Mat3 = [
  [1.1271005818144368, -0.1413297634984383, -0.14132976349843826],
  [-0.11060664309660323, 1.157823702216272, -0.11060664309660294],
  [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405],
]

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x))

function aces(colour: Vec3, exposure: number): Vec3 {
  const v = apply(ACES_IN, colour.map((c) => (c * exposure) / 0.6) as Vec3)
  const fitted = v.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081)) as Vec3
  return apply(ACES_OUT, fitted).map(clamp01) as Vec3
}

function agx(colour: Vec3, exposure: number): Vec3 {
  const [minEv, maxEv] = [-12.47393, 4.026069]
  const v = apply(AGX_INSET, apply(SRGB_TO_REC2020, colour.map((c) => c * exposure) as Vec3))
  const curve = v.map((x) => {
    const t = clamp01((Math.log2(Math.max(x, 1e-10)) - minEv) / (maxEv - minEv))
    const [t2, t4] = [t * t, t * t * t * t]
    return 15.5 * t4 * t2 - 40.14 * t4 * t + 31.96 * t4 - 6.868 * t2 * t + 0.4298 * t2 + 0.1191 * t - 0.00232
  }) as Vec3
  const out = apply(AGX_OUTSET, curve).map((x) => Math.max(0, x) ** 2.2) as Vec3
  return apply(REC2020_TO_SRGB, out).map(clamp01) as Vec3
}

export function encodeSrgb(linear: number): number {
  return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055
}

export function decodeSrgb(display: number): number {
  return display <= 0.04045 ? display / 12.92 : ((display + 0.055) / 1.055) ** 2.4
}

const luma = (c: Vec3): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** The grade of post.ts with its vignette reduced to a factor (1 at the centre of the screen). */
function grade(colour: Vec3, time: TimeOfDay, vignette: number): Vec3 {
  const g = LOOKS[time].grade
  const grey = luma(colour)
  const t = smoothstep(0.05, 0.75, grey)
  const shadow = [g.shadowTint.r, g.shadowTint.g, g.shadowTint.b]
  const highlight = [g.highlightTint.r, g.highlightTint.g, g.highlightTint.b]
  const lift = [g.lift.r, g.lift.g, g.lift.b]
  const lifted = colour.map((c, i) => c * (shadow[i] + (highlight[i] - shadow[i]) * t) + lift[i] * (1 - grey) * (1 - grey))
  const contrasted = lifted.map((c) => (c - 0.42) * g.contrast + 0.42) as Vec3
  const newGrey = luma(contrasted)
  return contrasted.map((c) => clamp01((newGrey + (c - newGrey) * g.saturation) * vignette)) as Vec3
}

/**
 * The vignette factor of post.ts at a point of the screen (`u`, `v` from 0 to 1). The backdrop shader
 * repeats this formula to pick its colour row.
 */
export function vignetteAt(u: number, v: number, time: TimeOfDay): number {
  return 1 - smoothstep(0.35, 0.95, Math.hypot(u - 0.5, v - 0.5)) * LOOKS[time].grade.vignette
}

/** Linear scene colour (what the backdrop shader writes) to the display colour the palette pass receives. */
export function displayed(linear: Vec3, time: TimeOfDay, vignette = 1): Vec3 {
  const look = LOOKS[time]
  const mapped = time === 'night' ? aces(linear, look.exposure) : agx(linear, look.exposure)
  return grade(mapped.map(encodeSrgb) as Vec3, time, vignette)
}

/**
 * The linear scene colour that is displayed as `target` (display values 0..1), found by a few damped
 * Gauss-Newton steps from `guess` (or the plain sRGB decode). Out-of-reach targets come back as the closest reachable.
 */
export function sceneColourFor(target: Vec3, time: TimeOfDay, vignette = 1, guess?: Vec3): Vec3 {
  const toUnknown = (x: Vec3): Vec3 => x.map((c) => Math.log(Math.max(c, 1e-5))) as Vec3
  const fromUnknown = (u: Vec3): Vec3 => u.map((c) => Math.exp(c)) as Vec3
  let u = toUnknown(guess ?? (target.map(decodeSrgb) as Vec3))
  let last = Infinity
  let jacobian: Mat3 | null = null
  for (let step = 0; step < 16; step += 1) {
    const f = displayed(fromUnknown(u), time, vignette)
    const error = f.map((value, i) => value - target[i]) as Vec3
    const size = Math.hypot(...error)
    // A tenth of a palette pass look-up step is far closer than needed; an out-of-reach target stops improving.
    if (size < 2e-3 || size > last * 0.98) break
    last = size
    // Jacobian by finite differences, in log space so the solve never goes negative; refreshed every few
    // steps only, since the curves are smooth and each refresh costs three more evaluations.
    if (step % 3 === 0 || !jacobian) {
      jacobian = [0, 1, 2].map((axis) => {
        const nudged = [...u] as Vec3
        nudged[axis] += 1e-3
        return displayed(fromUnknown(nudged), time, vignette).map((value, i) => (value - f[i]) / 1e-3) as Vec3
      }) as unknown as Mat3
    }
    const delta = solve(jacobian, error)
    u = u.map((value, i) => value - Math.max(-1, Math.min(1, delta[i]))) as Vec3
  }
  return fromUnknown(u)
}

/** Least-squares solve of J d = e (J given as columns), with a little damping for flat directions. */
function solve(columns: Mat3, e: Vec3): Vec3 {
  const j = (row: number, column: number): number => columns[column][row]
  const a: number[][] = [0, 1, 2].map((r) => [0, 1, 2].map((c) => [0, 1, 2].reduce((sum, k) => sum + j(k, r) * j(k, c), 0) + (r === c ? 1e-6 : 0)))
  const b: number[] = [0, 1, 2].map((r) => [0, 1, 2].reduce((sum, k) => sum + j(k, r) * e[k], 0))
  const det = (m: number[][]): number =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  const d = det(a)
  return [0, 1, 2].map((column) => det(a.map((row, r) => row.map((value, c) => (c === column ? b[r] : value)))) / d) as Vec3
}
