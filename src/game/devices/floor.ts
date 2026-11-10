import { roomAt, type Room } from '../site'
import type { Device, World } from '../world'

/** One storey of one building: the unit a terminal controls ("this floor"). */
export type Floor = { building: string; storey: number; floorY: number; rooms: Room[] }

export function roomOf(world: World, device: Device): Room | undefined {
  if (device.roomId !== undefined) {
    const room = world.rooms.find((candidate) => candidate.id === device.roomId)
    if (room) return room
  }
  return roomAt(world.rooms, device.x, device.y)
}

export function floorOf(world: World, device: Device): Floor | null {
  const room = roomOf(world, device)
  if (!room) return null
  return floorAt(world, room.building, room.storey, room.floorY)
}

export function floorAt(world: World, building: string, storey: number, floorY: number): Floor {
  const rooms = world.rooms.filter((room) => room.building === building && room.storey === storey)
  return { building, storey, floorY, rooms }
}

export function onFloor(world: World, floor: Floor, device: Device): boolean {
  const room = roomOf(world, device)
  return room !== undefined && room.building === floor.building && room.storey === floor.storey
}

/** Columns from the wall left of the first room to the wall right of the last, so partitions and vault walls count. */
export function floorSpan(floor: Floor): { from: number; to: number } | null {
  if (floor.rooms.length === 0) return null
  const from = Math.min(...floor.rooms.map((room) => room.x)) - 1
  const to = Math.max(...floor.rooms.map((room) => room.x + room.w))
  return { from, to }
}
