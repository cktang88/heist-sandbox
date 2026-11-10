import type { PropState } from '../../game/cover'
import type { Vec } from '../../game/types'
import type { BuildJob, StepResult } from '../core/buildQueue'
import { gpuReady } from '../core/gpu'
import { Region, type PlacedProp } from './region'

/**
 * A few props of every kind on the site, in their different looks, batched once while the loading screen is up and
 * then thrown away. Building them paints every prop texture and compiles every shader the props will need, so a
 * region built later during play (far from the drop) only reuses what exists and never stalls a frame on a compile.
 * It uses real props, so the models built for it are the ones their regions use later.
 */

/** Different looks kept per kind: variants that differ only in colour share a shader, so a few is plenty. */
const LOOKS_PER_KIND = 4
/** Props of a kind tried before giving up on finding more looks. */
const TRIES_PER_KIND = 12

export function showcaseJob(props: readonly PropState[], placedOf: (index: number) => PlacedProp, at: Vec): BuildJob {
  const byKind = new Map<string, number[]>()
  props.forEach((prop, index) => {
    const list = byKind.get(prop.kind) ?? byKind.set(prop.kind, []).get(prop.kind)!
    if (list.length < TRIES_PER_KIND) list.push(index)
  })
  const candidates = [...byKind.values()].reverse()
  const chosen: number[] = []
  let looks = new Set<string>()
  let region: Region | null = null
  return {
    x: at.x,
    y: at.y,
    get cause() {
      return `prop showcase ${region ? region.phase : 'prop'}`
    },
    step(): StepResult {
      // Compiling needs the renderer, which layers only get once the first frame has been drawn.
      if (!gpuReady()) return 'waiting'
      const kind = candidates[candidates.length - 1]
      if (kind) {
        const index = kind.shift()
        if (index !== undefined && looks.size < LOOKS_PER_KIND) {
          const { shape } = placedOf(index)
          if (!looks.has(shape)) chosen.push(index)
          looks.add(shape)
        }
        if (kind.length === 0 || looks.size >= LOOKS_PER_KIND) {
          candidates.pop()
          looks = new Set()
        }
        return 'more'
      }
      if (!region) {
        region = new Region(chosen)
        region.start(() => false)
      }
      const result = region.step(placedOf)
      if (result === 'done') region.dispose()
      return result
    },
  }
}
