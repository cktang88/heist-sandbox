import type { WebGLRenderer } from 'three'
import { stepTimings, type SlowStep } from '../../game/stepTimings'
import { cardPageCount } from '../propbatch/cardAtlas'
import { propKindsKept3d } from '../propbatch/region'
import { jobCount } from './buildQueue'
import { playStartedMs, worstFrames, type WorstFrame } from './frameProbe'

/** What `globalThis.__renderInfo` holds with `?debug=1`: counts for the last frame, refreshed about once a second. */
export type RenderInfo = {
  drawCalls: number
  triangles: number
  programs: number
  textures: number
  geometries: number
  renderScale: number
  qualityLevel: number
  averageFrameMs: number
  /** The longest frames since play started (JavaScript time only) and what they were spent on. */
  worstFrames: readonly WorstFrame[]
  /**
   * The slowest simulation steps since the page opened (top five), each with the system that took longest in it, and
   * the worst step time: next to `worstFrames`, so a long frame's "simulation" part can be traced to a game system.
   */
  slowestSteps: readonly SlowStep[]
  worstStepMs: number
  /** Milliseconds from opening the page until play started (the loading screen went away). */
  loadedAtMs: number
  /** Scene pieces still waiting to be built (the site finishes building during play). */
  buildJobs: number
  /**
   * The browser's own long-animation-frame reports since play started (over 50 ms, whole frame including drawing
   * and style work), worst first, with the script that took longest in each. Empty where the browser lacks them.
   */
  longFrames: readonly LongFrame[]
  /** Furniture card atlas pages (each about 48 MB of GPU memory) and the prop kinds that stayed 3D somewhere. */
  cardPages: number
  props3d: readonly string[]
}

export type LongFrame = { ms: number; at: number; script: string }

const KEPT_LONG_FRAMES = 8

/** Watches `long-animation-frame` entries (Chromium) and keeps the worst few after loading. */
function watchLongFrames(): LongFrame[] {
  const kept: LongFrame[] = []
  type Entry = PerformanceEntry & { scripts?: { duration: number; sourceURL?: string; sourceFunctionName?: string; invoker?: string }[] }
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Entry[]) {
        if (playStartedMs() === 0 || entry.startTime < playStartedMs()) continue
        const top = [...(entry.scripts ?? [])].sort((a, b) => b.duration - a.duration)[0]
        kept.push({ ms: Math.round(entry.duration), at: Math.round(entry.startTime), script: top ? `${top.invoker ?? ''} ${top.sourceFunctionName ?? ''} ${Math.round(top.duration)} ms` : '' })
        kept.sort((a, b) => b.ms - a.ms)
        kept.length = Math.min(kept.length, KEPT_LONG_FRAMES)
      }
    }).observe({ type: 'long-animation-frame', buffered: false })
  } catch {
    // Not every browser reports long animation frames.
  }
  return kept
}

const REFRESH_MS = 1000

/** Publishes renderer counters for the debug overlay and tests. Does nothing unless the address has `debug=1`. */
export function createRenderInfo(renderer: WebGLRenderer, enabled: boolean): { publish(now: number, scale: number, level: number, averageMs: number): void } {
  let last = -Infinity
  const longFrames = enabled ? watchLongFrames() : []
  return {
    publish(now, scale, level, averageMs) {
      if (!enabled || now - last < REFRESH_MS) return
      last = now
      const info: RenderInfo = {
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        programs: renderer.info.programs?.length ?? 0,
        textures: renderer.info.memory.textures,
        geometries: renderer.info.memory.geometries,
        renderScale: scale,
        qualityLevel: level,
        averageFrameMs: Math.round(averageMs * 10) / 10,
        worstFrames: worstFrames().slice(),
        slowestSteps: stepTimings().slowest.slice(0, 5),
        worstStepMs: stepTimings().worstMs,
        loadedAtMs: playStartedMs(),
        buildJobs: jobCount(),
        longFrames: longFrames.slice(),
        cardPages: cardPageCount(),
        props3d: propKindsKept3d(),
      }
      ;(globalThis as { __renderInfo?: RenderInfo }).__renderInfo = info
    },
  }
}
