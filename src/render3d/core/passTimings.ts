import type { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import type { Pass } from 'three/examples/jsm/postprocessing/Pass.js'

/**
 * With `?debug=1`, every full-screen pass of the post chain is timed: script time spent issuing it (the GPU's own
 * time is not measurable in the test browser) and the size of the last target it drew into (the screen for the last
 * pass). Published on `__renderInfo.passes`, averaged over the frames since the last publish.
 */
export type PassTiming = { name: string; ms: number; width: number; height: number; enabled: boolean }

const debug = typeof location !== 'undefined' && new URLSearchParams(location.search).get('debug') === '1'

type Totals = { pass: Pass; name: string; ms: number; frames: number; width: number; height: number }
let totals: Totals[] = []
let look = ''

const labels = new WeakMap<Pass, string>()

/** Names a pass whose class says little (a plain shader pass) for the timings. */
export function labelPass<T extends Pass>(pass: T, name: string): T {
  labels.set(pass, name)
  return pass
}

function nameOf(pass: Pass): string {
  return labels.get(pass) ?? pass.constructor.name.replace(/Pass$/, '')
}

/** Wraps each pass's `render` with a timer. Does nothing without `?debug=1`. */
export function instrumentPasses(composer: EffectComposer, lookName: string): void {
  if (!debug) return
  look = lookName
  totals = composer.passes.map((pass) => ({ pass, name: nameOf(pass), ms: 0, frames: 0, width: 0, height: 0 }))
  composer.passes.forEach((pass, index) => {
    const render = pass.render.bind(pass)
    const entry = totals[index]
    pass.render = (...args: Parameters<Pass['render']>) => {
      const renderer = args[0]
      const start = performance.now()
      render(...args)
      entry.ms += performance.now() - start
      entry.frames += 1
      const target = renderer.getRenderTarget()
      const size = target ? { width: target.width, height: target.height } : renderer.domElement
      entry.width = size.width
      entry.height = size.height
    }
  })
}

/** The passes of the current look with their average time since the last call, and the look's name. */
export function takePassTimings(): { look: string; passes: PassTiming[] } {
  const passes = totals.map((entry) => ({
    name: entry.name, ms: entry.frames > 0 ? Math.round((entry.ms / entry.frames) * 100) / 100 : 0, width: entry.width, height: entry.height, enabled: entry.pass.enabled,
  }))
  for (const entry of totals) {
    entry.ms = 0
    entry.frames = 0
  }
  return { look, passes }
}
