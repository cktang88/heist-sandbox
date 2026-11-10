/** How long errors may repeat on every frame before the game stops and says so, instead of flickering on. */
const STOP_AFTER_SECONDS = 2

export type FrameState = 'running' | 'stopped'

export type FrameGuard = {
  /** Runs one part of the frame; an error is caught and logged (once per distinct message). False if it threw. */
  attempt(part: string, work: () => void): boolean
  /** Closes the frame. Stays 'stopped' once errors have repeated on every frame for a couple of seconds. */
  endFrame(nowSeconds: number): FrameState
  /** The last error, with what was running, for the "Copy error details" button. */
  details(): string
  /** Forgets everything, for a new heist. */
  reset(): void
}

/**
 * Keeps the animation loop alive when one frame of the simulation or of drawing throws: that frame's part is
 * skipped and the loop carries on. Pure (the log is passed in) so the rules can be tested without a browser.
 */
export function createFrameGuard(log: (...parts: unknown[]) => void): FrameGuard {
  const logged = new Set<string>()
  let failedThisFrame = false
  let failingSince: number | null = null
  let stopped = false
  let lastDetails = ''

  return {
    attempt(part, work) {
      try {
        work()
        return true
      } catch (error) {
        failedThisFrame = true
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
        lastDetails = `While running: ${part}\n${message}\n${error instanceof Error ? error.stack ?? '' : ''}`
        const key = `${part}|${message}`
        if (!logged.has(key)) {
          logged.add(key)
          log(`[Smash & Grab] error in ${part}, frame skipped:`, error)
        }
        return false
      }
    },
    endFrame(nowSeconds) {
      if (!failedThisFrame) failingSince = null
      else if (failingSince === null) failingSince = nowSeconds
      failedThisFrame = false
      if (failingSince !== null && nowSeconds - failingSince >= STOP_AFTER_SECONDS) stopped = true
      return stopped ? 'stopped' : 'running'
    },
    details: () => lastDetails,
    reset() {
      logged.clear()
      failedThisFrame = false
      failingSince = null
      stopped = false
      lastDetails = ''
    },
  }
}
