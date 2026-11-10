import type { Stairwell } from '../site'
import { landingX } from '../stairs'
import type { Vec } from '../types'
import type { World } from '../world'
import { zoneAt } from './killZones'
import { feetOf, isActive, type Guard } from './model'
import { buildingAt, sameFloor } from './places'

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

type Option = { points: Vec[]; cost: number }

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
    // Coming out on the side the squad already holds is no flank, just another way in.
    const cost = Math.abs(start.x - feet.x) + Math.abs(exit.x - threat.x) + (side === pinSide ? 40 : 0)
    options.push({ points: [start, exit, end], cost })
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
        if (Math.sign(exit.x - threat.x) !== -pinSide || zoneAt(world, exit)) continue
        const across = { x: landingX(down, c), y: via }
        const end = { x: threat.x - pinSide * BEYOND, y: feet.y }
        const cost = Math.abs(start.x - feet.x) + Math.abs(across.x - landingX(up, b)) + Math.abs(exit.x - end.x)
        options.push({ points: [start, { x: landingX(up, b), y: via }, across, exit, end], cost })
      }
    }
  }
  return options
}

function stopOn(well: Stairwell, floorY: number): number {
  return well.stops.findIndex((y) => Math.abs(y - floorY) < 0.5)
}
