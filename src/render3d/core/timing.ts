import { noteFramePart } from './frameProbe'

/**
 * Start-up work is wrapped in User Timing measures (`performance.measure`), so it shows by name in the browser's
 * performance panel, and with `?debug=1` each one is also logged, to see where load time goes.
 */
const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1'

export function measured<T>(name: string, work: () => T): T {
  const start = performance.now()
  const result = work()
  const end = performance.now()
  performance.measure(name, { start, end })
  if (debug) console.info(`[perf] ${name}: ${Math.round(end - start)} ms`)
  return result
}

/** Times one part of the current frame for the frame probe (`?debug=1`, `__renderInfo.worstFrames`). */
export function timedPart(cause: string, work: () => void): void {
  const start = performance.now()
  work()
  noteFramePart(cause, performance.now() - start)
}
