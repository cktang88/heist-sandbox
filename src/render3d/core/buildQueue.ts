import type { Vec } from '../../game/types'
import { noteFramePart } from './frameProbe'

/**
 * Building the scene (prop batches, device models and the like) happens in small steps spread over frames, nearest
 * the view first, so no single frame stalls. While the loading screen is up the budget per frame is large (the bar
 * moves and the page stays responsive); during play it is a few milliseconds, which is enough to stay ahead of the
 * camera and, over a minute or so, to finish the whole site so that nothing is ever built at the last moment.
 */

/** What one step reports: more steps to come, finished, or waiting for something to load (skipped for now). */
export type StepResult = 'more' | 'done' | 'waiting'

export type BuildJob = {
  /** Centre of what it builds, in game tiles: jobs nearest the view go first. */
  x: number
  y: number
  /** Plain words for the frame probe, e.g. `props 96,144`. */
  cause: string
  /** Does one small piece of the work (a few milliseconds at most). */
  step(): StepResult
}

/** Milliseconds of building per frame during play, and while the loading screen hides the scene. */
const PLAY_BUDGET_MS = 3
const LOADING_BUDGET_MS = 45

let jobs: BuildJob[] = []
let loading = true

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

function distance(job: BuildJob, view: Vec): number {
  return Math.abs(job.x - view.x) + Math.abs(job.y - view.y) * 1.6
}

/** Runs steps of the nearest unfinished jobs until this frame's budget is spent. */
export function runBuildJobs(view: Vec): void {
  if (jobs.length === 0) return
  const budget = loading ? LOADING_BUDGET_MS : PLAY_BUDGET_MS
  const start = performance.now()
  jobs.sort((a, b) => distance(a, view) - distance(b, view))
  const waiting = new Set<BuildJob>()
  while (performance.now() - start < budget) {
    const job = jobs.find((candidate) => !waiting.has(candidate))
    if (!job) break
    const before = performance.now()
    const result = job.step()
    noteFramePart(`build ${job.cause}`, performance.now() - before)
    if (result === 'done') jobs.splice(jobs.indexOf(job), 1)
    else if (result === 'waiting') waiting.add(job)
  }
}

/** How many unfinished jobs have their centre inside the rectangle (game tiles, inclusive). */
export function jobsWithin(x0: number, y0: number, x1: number, y1: number): number {
  let count = 0
  for (const job of jobs) if (job.x >= x0 && job.x <= x1 && job.y >= y0 && job.y <= y1) count += 1
  return count
}

export function jobCount(): number {
  return jobs.length
}
