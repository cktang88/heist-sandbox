import { landingX } from '../stairs'
import type { Vec } from '../types'
import type { World } from '../world'
import { createGuard, setMode } from './model'
import { buildingAt, floorBelow } from './places'
import { log } from './report'
import { planSearch } from './search'
import { LEVELS } from './tuning'

/**
 * The armoured response team. It drives in from the end of the street opposite the getaway van when the
 * site reaches alert level 3, enters the building where the intruder was last reported, and sweeps it
 * floor by floor up (or down) the stairs to that floor before searching around the last known position.
 */

const MAX_TEAMS = 3
const SWEEP_SECONDS = 150

export function deployResponders(world: World): void {
  const security = world.security
  if (security.responders >= MAX_TEAMS) return
  security.responders += 1
  const goal = security.lastKnown ? floorBelow(world, security.lastKnown) : security.focus
  const fromRight = world.extraction.x < world.grid.width / 2
  for (let index = 0; index < LEVELS.respondersAtLevel3; index += 1) {
    const x = fromRight ? world.grid.width - 4 - index * 2 : 3 + index * 2
    const responder = createGuard({ x, y: world.groundY, facing: fromRight ? -1 : 1 }, true)
    responder.checkInAt = Infinity
    if (goal) {
      responder.search = { ...planSearch(world, goal, SWEEP_SECONDS), index: 0 }
      responder.search.points = [...sweepPoints(world, goal), ...responder.search.points]
      responder.lastKnown = security.lastKnown ? { ...security.lastKnown } : null
      responder.lastKnownAt = world.clock
    }
    setMode(responder, goal ? 'searching' : 'caution')
    responder.announced = responder.mode
    world.guards.push(responder)
  }
  log(world, 'Control: Response team is on site.')
}

/** Each landing from the ground up to the goal's floor, in the staircase nearest the goal. */
function sweepPoints(world: World, goal: Vec): Vec[] {
  const building = buildingAt(world, goal)
  const wells = world.stairwells.filter((well) => well.building === building)
  const well = wells.sort((a, b) => Math.abs(a.leftX - goal.x) - Math.abs(b.leftX - goal.x))[0]
  if (!well) return []
  const target = well.stops.findIndex((y) => Math.abs(y - goal.y) < 0.5)
  const ground = well.stops.findIndex((y) => Math.abs(y - world.groundY) < 0.5)
  if (target < 0) return []
  const start = ground >= 0 ? ground : 0
  const points: Vec[] = []
  const step = target >= start ? 1 : -1
  for (let stop = start; stop !== target; stop += step) points.push({ x: landingX(well, stop), y: well.stops[stop] })
  return points
}
