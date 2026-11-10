/**
 * Keeps the frame rate up by stepping down a ladder of settings when frames run long, and back up
 * when there is room. Pure logic: the renderer feeds it frame times and applies whatever rung it reports.
 */

/** One rung of the ladder. Cheaper rungs come later. */
export type QualityLevel = {
  /** Share of the full resolution the scene is drawn at, before being stretched to the screen. */
  scale: number
  ambientOcclusion: boolean
  /** Hardware multisampling on the scene; otherwise a cheap edge-smoothing pass runs after tone mapping. */
  multisample: boolean
  /** Bloom resolution relative to its usual half of the scene resolution. */
  bloomScale: number
  shadows: boolean
}

/**
 * Most expensive effects go first. Multisampling is not used at all: a multisampled half-float scene target costs a
 * lot of bandwidth for every triangle edge, and the cheap edge-smoothing pass looks nearly the same in a side view.
 * Resolution then comes down in small steps (each change reallocates render targets, so not too many), ambient
 * occlusion goes early (it redraws the whole scene once more for normals), then bloom resolution, then shadows.
 */
export const LADDER: readonly QualityLevel[] = [
  { scale: 1, ambientOcclusion: true, multisample: false, bloomScale: 1, shadows: true },
  { scale: 0.9, ambientOcclusion: true, multisample: false, bloomScale: 1, shadows: true },
  { scale: 0.8, ambientOcclusion: false, multisample: false, bloomScale: 1, shadows: true },
  { scale: 0.7, ambientOcclusion: false, multisample: false, bloomScale: 0.5, shadows: true },
  { scale: 0.6, ambientOcclusion: false, multisample: false, bloomScale: 0.5, shadows: true },
  { scale: 0.5, ambientOcclusion: false, multisample: false, bloomScale: 0.5, shadows: false },
]

/** The forced low mode (`?quality=low`). */
export const LOW_DETAIL = LADDER.length - 1

/** Above this average frame time (about 50 fps) the ladder steps down. */
const SLOW_MS = 20
/** Below this (about 66 fps) for long enough, it steps back up. */
const FAST_MS = 15
/** Frames averaged before any decision, and frames to wait after a change before judging it. */
const WINDOW = 45
const SETTLE = 30
/** Climbing back needs a long run of good frames, so the ladder does not bounce between two rungs. */
const FAST_RUNS_TO_CLIMB = 4

export type QualityController = {
  /** Reports one frame's duration in ms; returns the rung to use (which may be unchanged). */
  frame(ms: number): number
  readonly level: number
  readonly averageMs: number
}

/**
 * `fixed` pins the rung (forced low mode, or a pinned top rung for screenshots).
 * Turning shadows off recompiles every material, so once dropped they stay off for the session.
 */
export function createQualityController(start: number, fixed: boolean): QualityController {
  let level = start
  let floor = 0
  const samples: number[] = []
  let settle = SETTLE
  let fastRuns = 0
  let averageMs = 0

  function change(to: number): void {
    level = to
    if (!LADDER[level].shadows) floor = level
    samples.length = 0
    settle = SETTLE
    fastRuns = 0
  }

  return {
    frame(ms) {
      // Long gaps (a hidden tab, a level being built) say nothing about drawing speed.
      if (ms > 250) return level
      samples.push(ms)
      if (samples.length > WINDOW) samples.shift()
      averageMs = samples.reduce((sum, value) => sum + value, 0) / samples.length
      if (fixed) return level
      if (settle > 0) {
        settle -= 1
        return level
      }
      if (samples.length < WINDOW) return level
      if (averageMs > SLOW_MS && level < LADDER.length - 1) change(level + 1)
      else if (averageMs < FAST_MS && level > floor) {
        fastRuns += 1
        samples.length = 0
        if (fastRuns >= FAST_RUNS_TO_CLIMB) change(level - 1)
      } else if (averageMs >= FAST_MS) fastRuns = 0
      return level
    },
    get level() {
      return level
    },
    get averageMs() {
      return averageMs
    },
  }
}
