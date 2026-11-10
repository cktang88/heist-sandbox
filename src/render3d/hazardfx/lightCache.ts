import { lightLevelAt } from '../../game/light'
import type { Vec } from '../../game/types'
import type { World } from '../../game/world'

/** How often a tile re-reads the room's light, and how many tiles may do so per frame. */
const LIGHT_REFRESH_SECONDS = 0.75
const LIGHT_READS_PER_FRAME = 40

export type LightCache = { begin(clock: number): void; at(spot: Vec): number }

/**
 * Remembers how lit each tile is, so unlit effects (smoke, water, fuel) darken with the room without re-tracing every
 * lamp each frame.
 */
export function createLightCache(world: World): LightCache {
  const cache = new Map<number, { level: number; stamp: number }>()
  let clock = 0
  let reads = 0
  return {
    begin(now) {
      clock = now
      reads = 0
      if (cache.size > 4000) cache.clear()
    },
    at(spot) {
      const key = Math.floor(spot.y) * world.grid.width + Math.floor(spot.x)
      const known = cache.get(key)
      if (known && (clock - known.stamp < LIGHT_REFRESH_SECONDS || reads >= LIGHT_READS_PER_FRAME)) return known.level
      if (!known && reads >= LIGHT_READS_PER_FRAME) return 0.4
      reads += 1
      const level = lightLevelAt(world, spot)
      cache.set(key, { level, stamp: clock })
      return level
    },
  }
}
