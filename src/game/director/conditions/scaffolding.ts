import { setTile, tileAt } from '../../tiles'
import type { World } from '../../world'
import type { ConditionDef } from '../types'

/**
 * Maintenance work: a scaffold ladder runs up one face of the tower, a quiet way to a floor high above the street,
 * and one lift is out of order, parked where it stands.
 */

const STOREY_ROWS = 6
const MIN_STOREYS = 5
const EXTRA_STOREYS = 6

export const scaffolding: ConditionDef = {
  id: 'scaffolding',
  fits: (site) => site === 'complex',
  excludes: [],
  start(world, rng) {
    // The scaffold goes up the face with windows to climb in by (the other may be the blank wall of the lift shaft).
    const coin = rng() < 0.5 ? -1 : 1
    const west = glassOnFace(world, -1)
    const east = glassOnFace(world, 1)
    const side = west === east ? coin : west > east ? -1 : 1
    const storeys = raiseScaffold(world, side, MIN_STOREYS + Math.floor(rng() * EXTRA_STOREYS))
    const lift = world.elevatorCars.length > 0 ? world.elevatorCars[Math.floor(rng() * world.elevatorCars.length)] : null
    if (lift) lift.locked = true
    const face = side < 0 ? 'west' : 'east'
    const climb = storeys > 0 ? `scaffolding climbs the tower's ${face} face to floor ${storeys}` : 'work crews have left tools about'
    return { id: 'scaffolding', line: `Maintenance: ${climb}${lift ? ', and one lift is out of order' : ''}.` }
  },
}

/** How many window tiles the tower's outer wall has on one side. */
function glassOnFace(world: World, side: number): number {
  const tower = world.rooms.filter((room) => room.building === 'tower' && room.storey >= 0)
  if (tower.length === 0) return 0
  const wall = side < 0 ? Math.min(...tower.map((room) => room.x)) - 1 : Math.max(...tower.map((room) => room.x + room.w))
  let glass = 0
  for (let y = 0; y < world.groundY; y += 1) if (tileAt(world.grid, wall, y) === 'glass') glass += 1
  return glass
}

/** Ladder up the open air beside the tower's outer wall, from the street up to as many storeys as stay clear. */
function raiseScaffold(world: World, side: number, storeys: number): number {
  const tower = world.rooms.filter((room) => room.building === 'tower' && room.storey >= 0)
  if (tower.length === 0) return 0
  const edge = side < 0 ? Math.min(...tower.map((room) => room.x)) - 2 : Math.max(...tower.map((room) => room.x + room.w)) + 1
  const top = world.groundY - storeys * STOREY_ROWS
  let y = world.groundY - 1
  for (; y >= top && tileAt(world.grid, edge, y) === 'air'; y -= 1) setTile(world.grid, edge, y, 'ladder')
  return Math.max(0, Math.floor((world.groundY - 1 - y) / STOREY_ROWS))
}
