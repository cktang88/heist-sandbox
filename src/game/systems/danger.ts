import { fireHeatAt } from '../hazards/fire'
import { gasAt, smokeDensityAt, toxicAt } from '../hazards/smoke'
import type { Vec } from '../types'
import type { World } from '../world'
import { footingAt } from './footing'
import { isLiveSpot } from './shock'

/**
 * What would hurt someone standing at a spot, for the guard code to steer by: avoid live water and fire, back out of
 * gas, step out from under something falling, walk carefully on a wet floor.
 */
export type HazardKind = 'shock' | 'fire' | 'falling' | 'gas' | 'smoke' | 'deepWater' | 'fuel' | 'slippery'

const SEVERITY: Record<HazardKind, number> = { shock: 1, fire: 1, falling: 0.9, gas: 0.6, smoke: 0.5, deepWater: 0.4, fuel: 0.3, slippery: 0.2 }
const GAS = 0.05
const CHOKING = 0.5

/** The worst hazard at a spot (a point in the tile a person stands in), or null. */
export function hazardKindAt(world: World, at: Vec): HazardKind | null {
  const x = Math.floor(at.x)
  const y = Math.floor(at.y)
  if (isLiveSpot(world, at)) return 'shock'
  if (fireHeatAt(world, x, y) > 0 || fireHeatAt(world, x, y - 1) > 0) return 'fire'
  if (world.systems.falling.some((item) => at.x >= item.x - 0.3 && at.x <= item.x + item.w + 0.3 && item.y < at.y)) return 'falling'
  if (gasAt(world, x, y) >= GAS || gasAt(world, x, y - 1) >= GAS) return 'gas'
  if (smokeDensityAt(world, { x: at.x, y: at.y - 1 }) >= CHOKING && toxicAt(world, { x: at.x, y: at.y - 1 }) > 0.2) return 'smoke'
  const footing = footingAt(world, at)
  if (footing === 'deep') return 'deepWater'
  if (footing === 'slick') return 'fuel'
  if (footing === 'wet') return 'slippery'
  return null
}

/** How dangerous a spot is, 0 (safe) to 1 (deadly). */
export function dangerAt(world: World, at: Vec): number {
  const kind = hazardKindAt(world, at)
  return kind ? SEVERITY[kind] : 0
}
