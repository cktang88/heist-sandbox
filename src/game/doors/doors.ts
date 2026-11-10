import { deviceState, doorKey } from '../devices/state'
import { keypadFor } from '../devices/locks'
import { setTile, tileAt, type Grid } from '../tiles'
import { overlaps, type Vec } from '../types'
import type { World } from '../world'

/**
 * Doors that have been opened, and how. Every door on a site starts shut; this remembers who opened each one and
 * whether it was opened by hand (a handle, a picked lock, a keycard) or forced (kicked in, pried). A door opened by hand
 * can be shut again, and once shut it shows nothing: a picked lock leaves no trace a patrol can see. A door missing
 * from this record that is no longer shut was blown or shot out, which counts as forced too.
 */

export type DoorHow = 'opened' | 'picked' | 'keycard' | 'forced'
export type OpenedDoor = { tiles: Vec[]; how: DoorHow; by: 'player' | 'guard' }

const MAX_DOOR_TILES = 8
const records = new WeakMap<World, Map<string, OpenedDoor>>()

/** Doors standing open by somebody's hand, keyed by `doorKeyAt` (column and bottom row). */
export function openedDoors(world: World): Map<string, OpenedDoor> {
  let map = records.get(world)
  if (!map) {
    map = new Map()
    records.set(world, map)
  }
  return map
}

/** The key of the door with a tile at this spot: its column and bottom row. */
export function doorKeyAt(world: World, column: number, row: number): string {
  let bottom = row
  while (tileAt(world.grid, column, bottom + 1) === 'door') bottom += 1
  return `${column},${bottom}`
}

/** Opens the whole door, not just the tile that was touched. Returns the tiles that opened. */
export function openDoor(grid: Grid, start: Vec): Vec[] {
  const queue: Vec[] = [start]
  const opened: Vec[] = []
  while (queue.length > 0 && opened.length < MAX_DOOR_TILES) {
    const { x, y } = queue.pop()!
    if (tileAt(grid, x, y) !== 'door') continue
    setTile(grid, x, y, 'air')
    opened.push({ x, y })
    queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 })
  }
  return opened
}

/** Opens a door and remembers how. Returns the door's key. */
export function openDoorBy(world: World, start: Vec, how: DoorHow, by: 'player' | 'guard'): string {
  const key = doorKeyAt(world, start.x, start.y)
  const tiles = openDoor(world.grid, start)
  if (tiles.length > 0) openedDoors(world).set(key, { tiles, how, by })
  world.structureChanged = true
  return key
}

/** Nobody (player or guard) stands in the doorway, and every tile of it is still open air (not blown away or filled). */
export function canClose(world: World, door: OpenedDoor): boolean {
  if (door.how === 'forced' || !door.tiles.every((tile) => tileAt(world.grid, tile.x, tile.y) === 'air')) return false
  const people = [world.player, ...world.guards.filter((guard) => guard.mode !== 'dead')]
  return !door.tiles.some((tile) => people.some((body) => overlaps(body, { x: tile.x, y: tile.y, w: 1, h: 1 })))
}

/**
 * Shuts a door that was opened by hand. It locks again behind itself: a keypad or a hacked lock has to be opened afresh.
 * Returns false if it could not be shut (someone in the way, forced, or no longer a doorway).
 */
export function closeDoor(world: World, key: string): boolean {
  const doors = openedDoors(world)
  const door = doors.get(key)
  if (!door || !canClose(world, door)) return false
  const unlocked = deviceState(world).unlockedDoors
  for (const tile of door.tiles) {
    setTile(world.grid, tile.x, tile.y, 'door')
    unlocked.delete(doorKey(tile))
    const keypad = keypadFor(world, tile)
    if (keypad) keypad.hacked = false
  }
  doors.delete(key)
  world.security.doorsNoticed.delete(key)
  world.structureChanged = true
  return true
}

/** The middle of an open doorway, at its bottom tile. */
export function doorCentre(door: OpenedDoor): Vec {
  const bottom = door.tiles.reduce((low, tile) => (tile.y > low.y ? tile : low), door.tiles[0])
  return { x: bottom.x + 0.5, y: bottom.y + 0.5 }
}
