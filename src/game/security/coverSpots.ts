import type { PropState } from '../cover'
import { propSpec } from '../propCatalog'
import { isSolidAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'

/**
 * Furniture that stops bullets, looked up by floor. Props never block walking; standing beside one,
 * on the far side from the threat, puts it between you and the shots ('high' hides a standing body,
 * 'low' only a crouching one).
 */
export type CoverProp = { prop: PropState; left: number; right: number; high: boolean }

const byWorld = new WeakMap<readonly PropState[], Map<number, CoverProp[]>>()

function coverByFloor(props: readonly PropState[]): Map<number, CoverProp[]> {
  let index = byWorld.get(props)
  if (index) return index
  index = new Map()
  for (const prop of props) {
    const spec = propSpec(prop.kind)
    if (spec.mount !== 'floor' || spec.cover === 'none') continue
    const centre = prop.x + 0.5
    const entry = { prop, left: centre - spec.w / 2, right: centre + spec.w / 2, high: spec.cover === 'high' }
    const row = Math.round(prop.y)
    index.set(row, [...(index.get(row) ?? []), entry])
  }
  byWorld.set(props, index)
  return index
}

/** Intact cover props on the floor with this feet row whose footprint comes within `reach` of x. */
export function coverNear(world: World, x: number, floorY: number, reach: number): CoverProp[] {
  const row = coverByFloor(world.props).get(Math.round(floorY)) ?? []
  return row.filter((entry) => !entry.prop.broken && entry.right >= x - reach && entry.left <= x + reach)
}

/** Is there cover right beside this body, between it and the threat? */
export function shelteredFrom(world: World, feet: Vec, threat: Vec, crouching: boolean): boolean {
  const side = Math.sign(threat.x - feet.x)
  return coverNear(world, feet.x, feet.y, 1.3).some((entry) => {
    if (!entry.high && !crouching) return false
    const centre = (entry.left + entry.right) / 2
    return Math.sign(centre - feet.x) === side || (feet.x > entry.left && feet.x < entry.right)
  })
}

export type CoverSpot = Vec & { high: boolean }

/**
 * The best place to stand behind cover against a threat. Advancing guards want cover at a working distance;
 * retreating ones want the nearest cover further from the threat than they are now.
 * `taken` lists spots other guards already hold, so two do not crowd one desk.
 */
export function findCover(world: World, feet: Vec, threat: Vec, reach: number, retreat: boolean, taken: readonly Vec[]): CoverSpot | null {
  let best: CoverSpot | null = null
  let bestScore = Infinity
  for (const entry of coverNear(world, feet.x, feet.y, reach)) {
    const centre = (entry.left + entry.right) / 2
    const side = Math.sign(threat.x - centre) || 1
    const spot = { x: side > 0 ? entry.left - 0.45 : entry.right + 0.45, y: feet.y, high: entry.high }
    const gap = Math.abs(spot.x - threat.x)
    if (gap < 3 || !standable(world, spot)) continue
    if (taken.some((other) => Math.abs(other.x - spot.x) < 0.9 && Math.abs(other.y - spot.y) < 1)) continue
    if (retreat && gap <= Math.abs(feet.x - threat.x)) continue
    const score = retreat
      ? Math.abs(spot.x - feet.x)
      : Math.abs(gap - 7) + Math.abs(spot.x - feet.x) * 0.5 + (entry.high ? 0 : 1.5)
    if (score < bestScore) {
      best = spot
      bestScore = score
    }
  }
  return best
}

function standable(world: World, spot: Vec): boolean {
  return isSolidAt(world.grid, spot.x, spot.y + 0.5) && !isSolidAt(world.grid, spot.x, spot.y - 0.5) && !isSolidAt(world.grid, spot.x, spot.y - 1.5)
}
