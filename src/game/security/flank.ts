import type { Stairwell } from '../site'
import { canWalkAcross } from '../gaps/gaps'
import { landingX } from '../stairs'
import type { Vec } from '../types'
import type { World } from '../world'
import { zoneAt } from './killZones'
import { feetOf, isActive, type Guard, type SearchPlan } from './model'
import { buildingAt, floorBelow, roomOf, sameFloor } from './places'

/**
 * A second way to the intruder, avoiding the lane he is covering. The pinning guards hold one side of him; a flanker
 * comes at him from the other side, or down from another storey: by another staircase that reaches his floor beyond
 * him, or, when he is on the flanker's own floor, up (or down) one storey by the near staircase, along, and back by a
 * staircase on the far side. Stair heads where colleagues have died are not used. Worked out once, when the guard is
 * given the job, not every frame.
 */

const STOREY = 6
/** Where the flanker stops beyond the intruder, along his floor. */
const BEYOND = 4
/** Long enough to walk a route over two storeys; after that he just goes for the man. */
const FLANK_SECONDS = 30
/** How far along his floor from above the man a flanker looks for a hole to drop through. */
const HOLE_REACH = 12

type Option = { points: Vec[]; cost: number }

/**
 * A flanking job for this guard against where he last knew the intruder to be, or null if there is no second way round.
 * A site with no staircases (the outpost's ladders) has no routes to plan: the flanker just goes for the far side of him.
 */
export function planFlank(world: World, guard: Guard): SearchPlan | null {
  if (!guard.lastKnown) return null
  const threat = floorBelow(world, guard.lastKnown)
  const side = Math.sign(threat.x - feetOf(guard).x) || 1
  const points = world.stairwells.length > 0 ? flankRoute(world, guard, threat) : [{ x: threat.x + side * 3, y: threat.y }]
  return points ? { points, index: 0, dwell: 0, endsAt: world.clock + FLANK_SECONDS } : null
}

/** Waypoints (feet positions) for a flank on the intruder at feet position `threat`, or null if there is no second way round. */
export function flankRoute(world: World, guard: Guard, threat: Vec): Vec[] | null {
  const feet = feetOf(guard)
  const pinSide = pinningSide(world, guard, threat)
  const building = buildingAt(world, feet)
  const wells = world.stairwells.filter((well) => well.building === building || building === 'site')
  const options = sameFloor(feet, threat) ? roundAbout(world, wells, feet, threat, pinSide) : downOnHim(world, wells, feet, threat, pinSide)
  options.sort((a, b) => a.cost - b.cost)
  return options[0]?.points ?? null
}

/** Which side of the intruder the rest of the squad is on (+1 right, -1 left): the side he is watching. */
function pinningSide(world: World, flanker: Guard, threat: Vec): number {
  let total = 0
  let count = 0
  for (const other of world.guards) {
    if (other === flanker || other.mode !== 'combat' || !isActive(other) || other.combatRole === 'flank') continue
    total += feetOf(other).x
    count += 1
  }
  const x = count > 0 ? total / count : feetOf(flanker).x
  return Math.sign(x - threat.x) || 1
}

/** He is on another floor: a staircase that comes out on his floor on the far side from the squad. */
function downOnHim(world: World, wells: Stairwell[], feet: Vec, threat: Vec, pinSide: number): Option[] {
  const options: Option[] = []
  for (const well of wells) {
    const from = stopOn(well, feet.y)
    const to = stopOn(well, threat.y)
    if (from < 0 || to < 0) continue
    const start = { x: landingX(well, from), y: feet.y }
    const exit = { x: landingX(well, to), y: threat.y }
    if (zoneAt(world, exit)) continue
    const side = Math.sign(exit.x - threat.x) || -pinSide
    const end = { x: threat.x + side * BEYOND, y: threat.y }
    // Coming out on the side the squad already holds is no flank, just another way in; coming down into his own room is.
    const behind = side !== pinSide || inRoomWith(world, exit, threat)
    const cost = Math.abs(start.x - feet.x) + Math.abs(exit.x - threat.x) + (behind ? 0 : 40)
    options.push({ points: [start, exit, end], cost })
  }
  return [...options, ...throughHoles(world, feet, threat, pinSide)]
}

/**
 * A hole blown in his floor near the man (beyond him, or in his room): drop through it on top of him. The way down is
 * the man's own work, and the squad never expects to use it.
 */
function throughHoles(world: World, feet: Vec, threat: Vec, pinSide: number): Option[] {
  if (threat.y <= feet.y) return []
  const floorY = Math.round(feet.y)
  const options: Option[] = []
  for (let x = Math.floor(threat.x) - HOLE_REACH; x <= Math.floor(threat.x) + HOLE_REACH; x += 1) {
    if (!canWalkAcross(world, x, floorY)) continue
    const below = floorBelow(world, { x: x + 0.5, y: floorY + 1 })
    if (!sameFloor(below, threat) || zoneAt(world, below)) continue
    const side = Math.sign(x + 0.5 - threat.x) || -pinSide
    if (side === pinSide && !inRoomWith(world, below, threat)) continue
    const hole = { x: x + 0.5, y: feet.y }
    options.push({ points: [hole, below, { x: threat.x + side * BEYOND, y: threat.y }], cost: Math.abs(hole.x - feet.x) + Math.abs(hole.x - threat.x) })
  }
  return options
}

/** He is on this floor: up or down a storey by a near staircase, along it, and back by one beyond him. */
function roundAbout(world: World, wells: Stairwell[], feet: Vec, threat: Vec, pinSide: number): Option[] {
  const options: Option[] = []
  for (const via of [feet.y - STOREY, feet.y + STOREY]) {
    for (const up of wells) {
      const a = stopOn(up, feet.y)
      const b = stopOn(up, via)
      if (a < 0 || b < 0) continue
      const start = { x: landingX(up, a), y: feet.y }
      if (Math.sign(start.x - threat.x) !== pinSide || zoneAt(world, start)) continue
      for (const down of wells) {
        const c = stopOn(down, via)
        const d = stopOn(down, feet.y)
        if (down === up || c < 0 || d < 0) continue
        const exit = { x: landingX(down, d), y: feet.y }
        const beyond = Math.sign(exit.x - threat.x) === -pinSide || inRoomWith(world, exit, threat)
        if (!beyond || zoneAt(world, exit)) continue
        const across = { x: landingX(down, c), y: via }
        const end = { x: threat.x - pinSide * BEYOND, y: feet.y }
        const cost = Math.abs(start.x - feet.x) + Math.abs(across.x - landingX(up, b)) + Math.abs(exit.x - end.x)
        options.push({ points: [start, { x: landingX(up, b), y: via }, across, exit, end], cost })
      }
    }
  }
  return options
}

/** Is this landing in the same room as the intruder (his own stairwell, say), so coming down it takes him from another side? */
function inRoomWith(world: World, landing: Vec, threat: Vec): boolean {
  const room = roomOf(world, threat)
  return room !== undefined && roomOf(world, landing)?.id === room.id
}

function stopOn(well: Stairwell, floorY: number): number {
  return well.stops.findIndex((y) => Math.abs(y - floorY) < 0.5)
}
