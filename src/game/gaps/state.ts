import type { Body } from '../types'
import { markAside, type AsideSource } from './aside'
import { createHoles, refreshHoles, type Holes, type SlabSource } from './holes'

/** Walk-past holes in floor slabs, and the floor each person last stood on (so a jump from below is not caught on the way back down). */
export type GapState = {
  holes: Holes
  /** Feet row of the last floor each person stood on. Kept only while there are holes to walk past. */
  stoodAt: Map<Body, number>
}

/** Also flags what was built beside the walking lane (see aside.ts), so it is in place before anyone moves. */
export function createGaps(site: SlabSource & AsideSource): GapState {
  markAside(site)
  return { holes: createHoles(site), stoodAt: new Map() }
}

/** The up-to-date holes of this world. A test that swaps in a new grid gets a fresh slab map for it. */
export function currentHoles(world: SlabSource & { gaps: GapState }): Holes {
  if (world.gaps.holes.grid !== world.grid) {
    world.gaps.holes = createHoles(world)
    world.gaps.stoodAt.clear()
  }
  refreshHoles(world.gaps.holes)
  return world.gaps.holes
}
