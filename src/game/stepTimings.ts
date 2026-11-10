/**
 * Optional timing of each system in `stepWorld`, for finding what makes a frame slow on a real machine. Off by
 * default, and then every call here is one test of a flag. When on, each system's time shows as a `sim:<system>`
 * measure in the browser's Performance panel (Timings track), and the slowest recent steps are kept with the
 * system that took most of each, for an on-screen readout (`stepTimings()`).
 */

/** How many recent steps the record looks back over: about ten seconds at 60 steps a second. */
const WINDOW = 600
/** How many of the slowest steps `stepTimings` reports. */
const REPORTED = 8
/** Measures pile up in the browser's timeline buffer; ours are cleared this often (in steps). */
const CLEAR_EVERY = 300

export type SlowStep = {
  /** Steps counted since timing was switched on. */
  step: number
  ms: number
  /** The system that took longest in that step, and how long it took. */
  system: string
  systemMs: number
}

export type StepTimings = {
  enabled: boolean
  /** Steps timed since timing was switched on. */
  steps: number
  /** Over the recent window: the mean and the worst step. */
  meanMs: number
  worstMs: number
  /** The slowest recent steps, slowest first. */
  slowest: SlowStep[]
}

let enabled = false
let steps = 0
let stepStarted = 0
let lapStarted = 0
let topSystem = ''
let topMs = 0
const totals = new Float64Array(WINDOW)
const tops: string[] = new Array<string>(WINDOW).fill('')
const topTimes = new Float64Array(WINDOW)
const measured = new Set<string>()

/** Switches timing on or off. Switching on starts a fresh record. */
export function enableStepTimings(on: boolean): void {
  enabled = on
  steps = 0
  totals.fill(0)
  topTimes.fill(0)
  tops.fill('')
}

export function stepTimingsEnabled(): boolean {
  return enabled
}

/** Called as a step starts. */
export function beginStepTiming(): void {
  if (!enabled) return
  stepStarted = performance.now()
  lapStarted = stepStarted
  topSystem = ''
  topMs = 0
}

/** Called right after a system has run: charges it with the time since the previous system finished. */
export function lapStepTiming(system: string): void {
  if (!enabled) return
  const now = performance.now()
  const spent = now - lapStarted
  const name = `sim:${system}`
  performance.measure(name, { start: lapStarted, end: now })
  measured.add(name)
  if (spent > topMs) {
    topMs = spent
    topSystem = system
  }
  lapStarted = performance.now()
}

/** Called as a step ends. */
export function endStepTiming(): void {
  if (!enabled) return
  const now = performance.now()
  const slot = steps % WINDOW
  totals[slot] = now - stepStarted
  tops[slot] = topSystem
  topTimes[slot] = topMs
  steps += 1
  if (steps % CLEAR_EVERY === 0) for (const name of measured) performance.clearMeasures(name)
}

/** What has been recorded: the recent mean and worst, and the slowest recent steps with what dominated each. */
export function stepTimings(): StepTimings {
  const count = Math.min(steps, WINDOW)
  const recent: SlowStep[] = []
  let sum = 0
  for (let back = 1; back <= count; back += 1) {
    const step = steps - back
    const slot = step % WINDOW
    sum += totals[slot]
    recent.push({ step, ms: totals[slot], system: tops[slot], systemMs: topTimes[slot] })
  }
  recent.sort((a, b) => b.ms - a.ms)
  return {
    enabled,
    steps,
    meanMs: count > 0 ? sum / count : 0,
    worstMs: recent.length > 0 ? recent[0].ms : 0,
    slowest: recent.slice(0, REPORTED),
  }
}
