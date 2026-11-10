import { circuitOf } from '../complex/kit'
import type { PropState } from '../cover'
import { propCenter } from '../hazards/props'
import { roomAt, type Room } from '../site'
import type { World } from '../world'

/**
 * Which lighting circuit feeds a thing, and whether it is live. Kit outside any room (street boxes) is on the
 * grid itself: `undefined`, always live, and no breaker in the building can trip it.
 */
const roomsById = new WeakMap<object, Map<number, Room>>()

function roomOf(world: World, id: number | undefined, x: number, y: number): Room | undefined {
  let byId = roomsById.get(world.rooms)
  if (!byId) {
    byId = new Map(world.rooms.map((room) => [room.id, room]))
    roomsById.set(world.rooms, byId)
  }
  return (id !== undefined ? byId.get(id) : undefined) ?? roomAt(world.rooms, x, y)
}

export function propCircuit(world: World, prop: PropState): number | undefined {
  const center = propCenter(prop)
  const room = roomOf(world, prop.roomId, center.x, center.y)
  return room && room.building !== 'grounds' ? circuitOf(room.building, room.storey) : undefined
}

export function circuitLive(world: World, circuit: number | undefined): boolean {
  return circuit === undefined || !world.deadCircuits.has(circuit)
}
