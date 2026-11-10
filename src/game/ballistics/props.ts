import type { PropState } from '../cover'
import { burst } from '../effects'
import { propBroke } from '../hazards/hazards'
import { propBox, propById, propCenter, propsAt } from '../hazards/props'
import { propSpec } from '../propCatalog'
import { playSound } from '../sounds'
import type { Rect, Vec } from '../types'
import type { World } from '../world'

/** A cover prop counts as still being passed through this close past its edges (cover.ts tests a short tail of each step). */
const EDGE = 0.35
const DEBRIS = '#8b7d6b'

/** Does cover.ts treat this prop as cover that can stop a shot? Those it damages itself. */
function isCover(prop: PropState): boolean {
  const spec = propSpec(prop.kind)
  return spec.mount === 'floor' && spec.cover !== 'none'
}

function inside(box: Rect, at: Vec, margin: number): boolean {
  return at.x >= box.x - margin && at.x <= box.x + box.w + margin && at.y >= box.y - margin && at.y <= box.y + box.h + margin
}

/** Unique prop ids on the tile under a point and the tiles beside it, which is as far as a step's tail reaches. */
function idsNear(world: World, at: Vec): Set<number> {
  const ids = new Set<number>()
  for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) for (const id of propsAt(world, Math.floor(at.x) + dx, Math.floor(at.y) + dy)) ids.add(id)
  return ids
}

/** After cover.ts reports a shot stopped by a prop: which prop was it? */
export function coverPropAt(world: World, at: Vec): PropState | null {
  for (const id of idsNear(world, at)) {
    const prop = propById(world, id)
    if (prop && isCover(prop) && inside(propBox(prop), at, EDGE)) return prop
  }
  return null
}

/** Is a round that already went into this cover prop still inside it (or just past its edge)? */
export function stillInside(prop: PropState, at: Vec): boolean {
  return inside(propBox(prop), at, EDGE)
}

/**
 * Reactive props that are not cover, such as gas cylinders, extinguishers, wall screens and neon signs, do not
 * stop a shot, but a round passing through one damages it, so it bursts, leaks, sparks or blows up through the
 * hazard system. Wall and ceiling items only take the player's fire: guards' stray rounds wrecking every sign
 * they cross would be noise. `struck` remembers what this round has already hit.
 */
export function shootLoosePropsAt(world: World, at: Vec, damage: number, fromPlayer: boolean, struck: Set<object>): void {
  for (const id of propsAt(world, Math.floor(at.x), Math.floor(at.y))) {
    const prop = propById(world, id)
    if (!prop || prop.broken || isCover(prop) || struck.has(prop)) continue
    const spec = propSpec(prop.kind)
    if (!spec.reacts || !Number.isFinite(prop.hp) || (spec.mount !== 'floor' && !fromPlayer)) continue
    if (!inside(propBox(prop), at, 0) || world.hazards.burningProps.has(prop.id)) continue
    struck.add(prop)
    burst(world.effects, world.rng, at, 2, DEBRIS, 3)
    hurtProp(world, prop, damage)
  }
}

/** The same breaking rule cover.ts applies to cover props: wear it down, and when it gives, let it react once. */
function hurtProp(world: World, prop: PropState, amount: number): void {
  prop.hp -= amount
  if (prop.hp > 0) return
  prop.hp = 0
  prop.broken = true
  const center = propCenter(prop)
  playSound(world, 'impact', center)
  burst(world.effects, world.rng, center, 8, DEBRIS, 6)
  propBroke(world, prop)
}
