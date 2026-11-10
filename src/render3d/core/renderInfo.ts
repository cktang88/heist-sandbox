import type { WebGLRenderer } from 'three'

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
      }
      ;(globalThis as { __renderInfo?: RenderInfo }).__renderInfo = info
    },
  }
}
