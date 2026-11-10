import type { PropState } from '../cover'
import { propBox, propById, propsNear } from '../hazards/props'
import { lightLevelAt } from '../light'
import type { PropKind } from '../propCatalog'
import { VISION } from '../security/tuning'
import type { Vec } from '../types'
import type { World } from '../world'

/**
 * Furniture that hides a person: inside (a locker, a wardrobe, a stall, a dumpster), under (a desk, a bed, a table)
 * or, for bodies only, behind (a tall shelf, but only where it is dark). Each takes a body or two; the player fits
 * where a body does, except in a fridge or a car boot.
 */
export type SpotHow = 'inside' | 'under' | 'behind'
export type SpotKind = { how: SpotHow; name: string; bodies: number; player: boolean }

const inside = (name: string, bodies: number, player = true): SpotKind => ({ how: 'inside', name, bodies, player })
const under = (name: string, bodies = 1): SpotKind => ({ how: 'under', name, bodies, player: true })
const behind = (name: string): SpotKind => ({ how: 'behind', name, bodies: 1, player: false })

const SPOTS: Partial<Record<PropKind, SpotKind>> = {
  wallLocker: inside('locker', 1),
  lockerRow: inside('locker', 2),
  ammoLocker: inside('locker', 1),
  wardrobe: inside('wardrobe', 2),
  medCabinet: inside('cabinet', 1),
  toiletStall: inside('stall', 1),
  showerStall: inside('stall', 1),
  dumpster: inside('dumpster', 2),
  fridge: inside('fridge', 1, false),
  car: inside('car boot', 1, false),
  van: inside('van', 2, false),
  desk: under('desk'),
  deskCorner: under('desk'),
  executiveDesk: under('desk'),
  receptionDesk: under('desk', 2),
  securityDesk: under('desk', 2),
  bed: under('bed'),
  medicalBed: under('bed'),
  conferenceTable: under('table', 2),
  crateStack: behind('crates'),
  shelvingRack: behind('shelves'),
  archiveShelf: behind('shelves'),
  bookshelf: behind('bookshelf'),
}

/** The prop kinds that hide something, for the report and the help text. */
export const HIDING_KINDS = Object.keys(SPOTS) as PropKind[]

export function spotKind(kind: PropKind): SpotKind | undefined {
  return SPOTS[kind]
}

/** How close the player (or a guard) must stand to use a hiding place. */
export const SPOT_REACH = 1.4

/** The floor point in front of a hiding place, where it is used from. */
export function spotFeet(prop: PropState): Vec {
  const box = propBox(prop)
  return { x: box.x + box.w / 2, y: box.y + box.h }
}

/** How far the feet are from the nearest edge of the prop along the floor (0 when standing over it). */
function gapTo(prop: PropState, feet: Vec): number {
  const box = propBox(prop)
  if (Math.abs(box.y + box.h - feet.y) > 0.8) return Infinity
  return Math.max(0, box.x - feet.x, feet.x - (box.x + box.w))
}

/** Bodies (guard indices) stuffed into this prop. */
export function bodiesIn(world: World, prop: PropState): number[] {
  const found: number[] = []
  world.guards.forEach((guard, index) => {
    if (guard.hiddenIn === prop.id) found.push(index)
  })
  return found
}

/** Room left for a body: its capacity minus the bodies in it, minus one if the player is in there too. */
export function roomForBody(world: World, prop: PropState): boolean {
  const kind = spotKind(prop.kind)
  if (!kind || prop.broken) return false
  const player = world.stealth.hiding?.prop === prop.id ? 1 : 0
  return bodiesIn(world, prop).length + player < kind.bodies
}

/** A body hidden behind furniture is only hidden while it is dark there. */
export function spotHides(world: World, prop: PropState): boolean {
  const kind = spotKind(prop.kind)
  if (!kind) return false
  if (kind.how !== 'behind') return true
  return lightLevelAt(world, spotFeet(prop)) < VISION.dim
}

/** The nearest hiding place in reach of these feet that passes `wanted`. */
export function nearestSpot(world: World, feet: Vec, wanted: (prop: PropState, kind: SpotKind) => boolean, reach = SPOT_REACH): PropState | null {
  let best: PropState | null = null
  let bestGap = reach
  for (const prop of propsNear(world, feet, reach + 3)) {
    const kind = spotKind(prop.kind)
    if (!kind || prop.broken || !wanted(prop, kind)) continue
    const gap = gapTo(prop, feet)
    if (gap > bestGap) continue
    best = prop
    bestGap = gap
  }
  return best
}

/** Hiding places within `radius` of a point on its floor, nearest first. */
export function spotsAround(world: World, at: Vec, radius: number): PropState[] {
  return propsNear(world, at, radius + 2)
    .filter((prop) => spotKind(prop.kind) && !prop.broken && gapTo(prop, at) <= radius)
    .sort((a, b) => gapTo(a, at) - gapTo(b, at))
}

export function spotProp(world: World, id: number): PropState | undefined {
  return propById(world, id)
}
