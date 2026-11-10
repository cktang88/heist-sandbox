import { landingX } from '../stairs'
import { isSolidAt, tileAt } from '../tiles'
import type { Vec } from '../types'
import type { World } from '../world'
import { createGuard, setMode } from './model'
import { buildingAt, floorBelow } from './places'
import { log } from './report'
import { planSearch } from './search'
import { LEVELS } from './tuning'

/**
 * The armoured response team. It drives up when the site reaches alert level 3, comes in at a street door of
 * the building where the intruder was last reported (from the end of the street opposite the getaway van on a
 * site without buildings), and sweeps it
 * floor by floor up (or down) the stairs to that floor before searching around the last known position.
 * One team per alert; a later alert (after the level has stepped back down) brings another, up to a limit.
 */

const MAX_TEAMS = 3
const SWEEP_SECONDS = 150

export function deployResponders(world: World): void {
  const security = world.security
  if (security.responseSent || security.responders >= MAX_TEAMS) return
  security.responseSent = true
  security.responders += 1
  const goal = security.lastKnown ? floorBelow(world, security.lastKnown) : security.focus
  const fromRight = world.extraction.x < world.grid.width / 2
  const door = goal ? streetDoor(world, goal, fromRight) : null
  for (let index = 0; index < LEVELS.respondersAtLevel3; index += 1) {
    const x = door ? door.x + door.inward * (2 + index * 1.5) : fromRight ? world.grid.width - 4 - index * 2 : 3 + index * 2
    const responder = createGuard({ x, y: world.groundY, facing: door ? door.inward : fromRight ? -1 : 1 }, true)
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

/**
 * Where the team comes in: just inside a street door of the building the intruder was reported in, on the side
 * away from the getaway van when that side has a door. The yards between the buildings are fenced and have open
 * manholes, so the team is set down at the door rather than made to find its way across them. Null on a site
 * without recorded buildings (the small outpost), where the team walks in from the street end.
 */
function streetDoor(world: World, goal: Vec, fromRight: boolean): { x: number; inward: 1 | -1 } | null {
  const building = buildingAt(world, goal)
  const ground = world.rooms.filter((room) => room.building === building && room.floorY === world.groundY)
  if (building === 'site' || ground.length === 0) return null
  const walls = [
    { x: Math.min(...ground.map((room) => room.x)) - 1, inward: 1 as const },
    { x: Math.max(...ground.map((room) => room.x + room.w)), inward: -1 as const },
  ]
  const doors = walls.filter((wall) => tileAt(world.grid, wall.x, world.groundY - 1) === 'door' || !isSolidAt(world.grid, wall.x, world.groundY - 1))
  if (doors.length === 0) return null
  return doors.find((wall) => (wall.inward === -1) === fromRight) ?? doors[0]
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
