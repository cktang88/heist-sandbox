/**
 * Records how long each frame's JavaScript took and what it was spent on, and keeps the worst frames since the game
 * started (loading frames are not counted). `?debug=1` publishes them on `globalThis.__renderInfo.worstFrames`, so a
 * hitch can be traced to its cause: a region being built, the simulation, or drawing.
 */

export type WorstFrame = { ms: number; cause: string }

const KEPT = 8
/** Parts of a frame shorter than this are left out of the cause, which only lists what mattered. */
const NOTEWORTHY_MS = 0.5

let parts: { cause: string; ms: number }[] = []
let worst: WorstFrame[] = []
let counting = false
let playStartedAt = 0
let lastMs = 0

function round(ms: number): number {
  return Math.round(ms * 10) / 10
}

/** Adds one part of the current frame, such as `simulation` or `build props 96,144`. */
export function noteFramePart(cause: string, ms: number): void {
  const known = parts.find((part) => part.cause === cause)
  if (known) known.ms += ms
  else parts.push({ cause, ms })
}

/** Closes the current frame. Before the game starts (`counting` off) frames are timed but not kept. */
export function endFrame(ms: number): void {
  lastMs = ms
  if (counting && (worst.length < KEPT || ms > worst[worst.length - 1].ms)) {
    const cause = parts.filter((part) => part.ms >= NOTEWORTHY_MS).sort((a, b) => b.ms - a.ms).map((part) => `${part.cause} ${round(part.ms)} ms`).join(', ')
    worst.push({ ms: round(ms), cause: cause || 'other' })
    worst.sort((a, b) => b.ms - a.ms)
    worst.length = Math.min(worst.length, KEPT)
  }
  parts = []
}

/** Starts keeping worst frames afresh, from the first frame of play. */
export function startCountingFrames(): void {
  counting = true
  worst = []
  playStartedAt = performance.now()
}

/** When play last started, in ms since the page opened: how long loading took. */
export function playStartedMs(): number {
  return Math.round(playStartedAt)
}

/** Script time of the last finished frame, which sets how much building the next one can afford. */
export function lastFrameMs(): number {
  return lastMs
}

export function worstFrames(): readonly WorstFrame[] {
  return worst
}
