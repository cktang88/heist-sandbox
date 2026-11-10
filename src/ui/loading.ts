/**
 * The loading screen. Its markup and style are in `index.html`, so it shows from the very first paint, before any
 * script has loaded; this only moves the bar, names the current step, and takes it away when play starts.
 */
export type LoadingScreen = {
  /** `done` is 0..1 for the whole start-up; `step` says in plain words what is happening. */
  show(done: number, step: string): void
  hide(): void
}

export function loadingScreen(): LoadingScreen {
  const root = document.querySelector<HTMLElement>('#loading')
  const bar = root?.querySelector<HTMLElement>('.sg-load-fill')
  const label = root?.querySelector<HTMLElement>('.sg-load-step')
  const percent = root?.querySelector<HTMLElement>('.sg-load-percent')
  let shown = 0
  // With `?debug=1` each step is logged with the time it started, to see where start-up time goes.
  const debug = new URLSearchParams(location.search).get('debug') === '1'
  let lastStep = ''
  const log = (step: string) => {
    if (debug && step !== lastStep) console.info(`[perf] ${Math.round(performance.now())} ms: ${step}`)
    lastStep = step
  }
  return {
    show(done, step) {
      log(step)
      if (!root || !bar || !label || !percent) return
      // The bar never runs backwards, even when a later step turns out to have more work than guessed.
      shown = Math.max(shown, Math.min(1, done))
      root.hidden = false
      bar.style.width = `${(shown * 100).toFixed(1)}%`
      percent.textContent = `${Math.round(shown * 100)}%`
      label.textContent = step
    },
    hide() {
      log('Playing')
      if (root) root.hidden = true
      shown = 0
    },
  }
}

/** Resolves after the browser has painted, so a step's label is on screen before its work blocks the page. */
export function nextPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)))
}
