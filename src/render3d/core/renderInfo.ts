import type { WebGLRenderer } from 'three'
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
  /** Milliseconds from opening the page until play started (the loading screen went away). */
  loadedAtMs: number
  /** Scene pieces still waiting to be built (the site finishes building during play). */
  buildJobs: number
}

const REFRESH_MS = 1000

/** Publishes renderer counters for the debug overlay and tests. Does nothing unless the address has `debug=1`. */
export function createRenderInfo(renderer: WebGLRenderer, enabled: boolean): { publish(now: number, scale: number, level: number, averageMs: number): void } {
  let last = -Infinity
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
        loadedAtMs: playStartedMs(),
        buildJobs: jobCount(),
      }
      ;(globalThis as { __renderInfo?: RenderInfo }).__renderInfo = info
    },
  }
}
