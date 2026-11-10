import type { PropState } from '../cover'
import { propById } from '../hazards/props'
import type { Vec } from '../types'
import type { World } from '../world'

/**
 * A prop the player has disturbed. Only these few are simulated (dragged, sliding, falling, flying);
 * the thousands of untouched props stay static and cost nothing. Position lives on the `PropState` itself,
 * so cover, fire and drawing all see the prop where it really is.
 */
export type LooseProp = {
  id: number
  vx: number
  vy: number
  /** Thrown and still in the air: the throw code moves it, not gravity. */
  flying: boolean
  /** Kicked over onto its side, falling away from the kicker; +1 means it fell to the right. */
  tipped: 0 | 1 | -1
  /** Where it was when the prop indexes last learned its position. */
  keyed: Vec
  /** People already hit by this prop during its current fall, so each is hurt once. */
  struck: Set<object>
  /** When guards started and last leant on it to force a door it is holding shut. */
  shoveStart: number
  shoveLast: number
  /** Pushed into a floor hole on purpose (down held while dragging): it drops through instead of riding the back strip. */
  dropping?: boolean
}

export type PhysPropsState = {
  loose: Map<number, LooseProp>
  /** The prop being dragged with grab held, and how far its left edge sits from the player's. */
  grabbed: { id: number; offset: number } | null
  /** Player position at the end of the last step: how far he moved this frame, and whether he came down onto a top. */
  last: (Vec & { feet: number }) | null
  /** Distance dragged since the last scrape was heard. */
  scraped: number
}

export function createPhysProps(): PhysPropsState {
  return { loose: new Map(), grabbed: null, last: null, scraped: 0 }
}

/** The simulated record of a prop, created the first time the player disturbs it. */
export function loosen(world: World, prop: PropState): LooseProp {
  const found = world.physProps.loose.get(prop.id)
  if (found) return found
  const loose: LooseProp = { id: prop.id, vx: 0, vy: 0, flying: false, tipped: 0, keyed: { x: prop.x, y: prop.y }, struck: new Set(), shoveStart: 0, shoveLast: -Infinity }
  world.physProps.loose.set(prop.id, loose)
  return loose
}

export function looseOf(world: World, prop: PropState): LooseProp | undefined {
  return world.physProps.loose.get(prop.id)
}

/** Each loose prop with its state; drops any that broke or vanished. */
export function looseProps(world: World): Array<{ prop: PropState; loose: LooseProp }> {
  const found: Array<{ prop: PropState; loose: LooseProp }> = []
  for (const loose of world.physProps.loose.values()) {
    const prop = propById(world, loose.id)
    if (!prop || prop.broken) world.physProps.loose.delete(loose.id)
    else found.push({ prop, loose })
  }
  return found
}

/** Moves a prop by an offset. Works for floor and wall mounts alike since it only translates. */
export function shiftProp(prop: PropState, dx: number, dy: number): void {
  prop.x += dx
  prop.y += dy
}

const REKEY_DISTANCE = 1

/**
 * Cover and the fire code bucket props by position, keyed on the `world.props` array. Handing them a fresh array
 * (same props, same order) makes them re-bucket. Done only when a loose prop has moved a whole tile or settled,
 * so a long drag costs a few rebuilds, not one per frame.
 */
export function rekeyIfMoved(world: World, prop: PropState, loose: LooseProp, settled: boolean): void {
  const moved = Math.abs(prop.x - loose.keyed.x) + Math.abs(prop.y - loose.keyed.y)
  if (moved === 0 || (!settled && moved < REKEY_DISTANCE)) return
  loose.keyed = { x: prop.x, y: prop.y }
  world.props = world.props.slice()
}
