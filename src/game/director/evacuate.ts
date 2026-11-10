import { floorAt } from '../devices/floor'
import { unlockFloorDoors } from '../devices/locks'
import type { Vec } from '../types'
import type { World } from '../world'

/** Getting people out of a building: where they gather, and the fire-code door release. */

const ASSEMBLY_GAP = 5

/** A spot on the street just outside the building's wall nearest the van, where evacuated guards gather. */
export function evacuationPoint(world: World, building: string): Vec {
  const rooms = world.rooms.filter((room) => room.building === building)
  if (rooms.length === 0) return { x: world.extraction.x + world.extraction.w + 6, y: world.groundY }
  const left = Math.min(...rooms.map((room) => room.x))
  const right = Math.max(...rooms.map((room) => room.x + room.w))
  const vanSide = world.extraction.x < left ? left - ASSEMBLY_GAP : right + ASSEMBLY_GAP
  return { x: Math.max(1, Math.min(world.grid.width - 2, vanSide)), y: world.groundY }
}

/** Releases every lock in the building, floor by floor (keypads too). */
export function unlockBuilding(world: World, building: string): void {
  for (const storey of storeysOf(world, building)) unlockStorey(world, building, storey)
}

export function unlockStorey(world: World, building: string, storey: number): void {
  const room = world.rooms.find((candidate) => candidate.building === building && candidate.storey === storey)
  if (room) unlockFloorDoors(world, floorAt(world, building, storey, room.floorY))
}

export function storeysOf(world: World, building: string): number[] {
  return [...new Set(world.rooms.filter((room) => room.building === building).map((room) => room.storey))].sort((a, b) => a - b)
}
