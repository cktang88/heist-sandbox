import type { Vec } from '../../game/types'
import { noteFramePart } from './frameProbe'

/**
 * Building the scene (wall chunks, room finishes, prop batches, uploads to the GPU) happens in small steps spread
 * over frames, nearest the view first, so no single frame stalls. While the loading screen is up the budget per frame
 * is large (the bar moves and the page stays responsive). Play starts as soon as what the opening view can reach is
 * built; the rest is built during play within a few milliseconds a frame, ahead of the camera.
 *
 * Nothing may appear half-built on screen, so a job whose area overlaps the view is finished this frame even past the
 * budget: if the player ever outruns the queue, that costs one slower frame rather than a hole in the picture.
 */

/** What one step reports: more steps to come, finished, or waiting for something to load (skipped for now). */
export type StepResult = 'more' | 'done' | 'waiting'

export type BuildJob = {
  /** Centre of what it builds, in game tiles: jobs nearest the view go first. */
  x: number
  y: number
  /** Half the size of the area it builds, in tiles (0 for a point). */
  halfW?: number
  halfH?: number
  /** Plain words for the frame probe, e.g. `props 96,144`. */
  cause: string
  /** Does one small piece of the work (a few milliseconds at most). */
  step(): StepResult
}

/** Milliseconds of building per frame while the loading screen hides the scene. */
const LOADING_BUDGET_MS = 60
/**
 * During play, building fills what is left of this much script time per frame, between these bounds: a cheap frame
 * (the opening drop through open sky) builds more, a busy one less.
 */
const PLAY_FRAME_TARGET_MS = 12
const PLAY_BUDGET_MIN_MS = 2
const PLAY_BUDGET_MAX_MS = 8
/** Half the area around the view that is on screen or about to be, in tiles (the view is about 42 x 24 at the lane). */
export const ON_SCREEN = { x: 27, y: 16 }
/** A frame never spends more than this on finishing jobs that are on screen. */
const URGENT_BUDGET_MS = 14

/** A single step longer than this is logged with `?debug=1`: steps are meant to be small. */
const SLOW_STEP_MS = 16
const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1'

let jobs: BuildJob[] = []
let loading = true
let spentMs = 0
let spentLastFrame = 0

export function addBuildJob(job: BuildJob): void {
  jobs.push(job)
}

/** Forgets every job: a new level is being set up. */
export function clearBuildJobs(): void {
  jobs = []
}

/** Called by the start-up sequence: a big budget while the loading screen is up, a small one once play starts. */
export function setLoading(value: boolean): void {
  loading = value
}

export function isLoading(): boolean {
  return loading
}

/** How far a job's area is from the view, in tiles; rows count a little more, as the view is wider than tall. */
function distance(job: BuildJob, view: Vec): number {
  const dx = Math.max(0, Math.abs(job.x - view.x) - (job.halfW ?? 0))
  const dy = Math.max(0, Math.abs(job.y - view.y) - (job.halfH ?? 0))
  return dx + dy * 1.6
}

function overlaps(job: BuildJob, x0: number, y0: number, x1: number, y1: number): boolean {
  const [hw, hh] = [job.halfW ?? 0, job.halfH ?? 0]
  return job.x + hw >= x0 && job.x - hw <= x1 && job.y + hh >= y0 && job.y - hh <= y1
}

function onScreen(job: BuildJob, view: Vec): boolean {
  return overlaps(job, view.x - ON_SCREEN.x, view.y - ON_SCREEN.y, view.x + ON_SCREEN.x, view.y + ON_SCREEN.y)
}

/**
 * The time this frame may spend building. `frameMs` is the whole script time of the last frame, of which
 * `spentLastFrame` was building, so the rest is what drawing and the simulation needed.
 */
function budgetFor(frameMs: number): number {
  if (loading) return LOADING_BUDGET_MS
  const rest = Math.max(0, frameMs - spentLastFrame)
  return Math.min(PLAY_BUDGET_MAX_MS, Math.max(PLAY_BUDGET_MIN_MS, PLAY_FRAME_TARGET_MS - rest))
}

/**
 * Runs steps of unfinished jobs until this frame's budget is spent: first those on screen, then those nearest `lead`,
 * a point ahead of the view in the direction it is moving (a falling player's landing comes before the sky beside
 * him). `lastFrameMs` is the last frame's script time.
 */
export function runBuildJobs(view: Vec, lastFrameMs = 0, lead: Vec = view): void {
  spentLastFrame = 0
  if (jobs.length === 0) return
  const budget = budgetFor(lastFrameMs)
  const start = performance.now()
  const order = new Map<BuildJob, number>()
  for (const job of jobs) order.set(job, onScreen(job, view) ? distance(job, view) - 1e6 : distance(job, lead))
  jobs.sort((a, b) => order.get(a)! - order.get(b)!)
  const waiting = new Set<BuildJob>()
  for (;;) {
    const elapsed = performance.now() - start
    const job = jobs.find((candidate) => !waiting.has(candidate))
    if (!job) break
    if (elapsed >= budget && (loading || elapsed >= URGENT_BUDGET_MS || !onScreen(job, view))) break
    const before = performance.now()
    const result = job.step()
    const took = performance.now() - before
    spentMs += took
    noteFramePart(`build ${job.cause}`, took)
    if (debug && took > SLOW_STEP_MS) console.info(`[perf] slow build step: ${job.cause} ${Math.round(took)} ms`)
    if (result === 'done') jobs.splice(jobs.indexOf(job), 1)
    else if (result === 'waiting') waiting.add(job)
  }
  spentLastFrame = performance.now() - start
}

/** How many unfinished jobs touch the rectangle (game tiles, inclusive). */
export function jobsWithin(x0: number, y0: number, x1: number, y1: number): number {
  let count = 0
  for (const job of jobs) if (overlaps(job, x0, y0, x1, y1)) count += 1
  return count
}

/** What the unfinished jobs touching the rectangle are, for debugging pop-in (`?debug=1` tools). */
export function jobsWithinNamed(x0: number, y0: number, x1: number, y1: number): string[] {
  return jobs.filter((job) => overlaps(job, x0, y0, x1, y1)).map((job) => `${job.cause} @${Math.round(job.x)},${Math.round(job.y)}`)
}

/** Total milliseconds spent building since the page opened. */
export function buildMsSpent(): number {
  return Math.round(spentMs)
}

export function jobCount(): number {
  return jobs.length
}
