import { deviceState, doorKey } from '../devices/state'
import { keypadFor } from '../devices/locks'
import { setTile, tileAt, type Grid } from '../tiles'
import { propBox, propsNear } from '../hazards/props'
import { propSpec } from '../propCatalog'
import { overlaps, type Rect, type Vec } from '../types'
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

/**
 * Nothing stands in the doorway (a person, a body, furniture, a pickup or the case, a grenade, frag or charge), and
 * every tile of it is still open air (not blown away or filled).
 */
export function canClose(world: World, door: OpenedDoor): boolean {
  if (door.how === 'forced' || !door.tiles.every((tile) => tileAt(world.grid, tile.x, tile.y) === 'air')) return false
  const blocked = (box: Rect) => door.tiles.some((tile) => overlaps(box, { x: tile.x, y: tile.y, w: 1, h: 1 }))
  return !inTheWay(world, door).some(blocked)
}

/** Everything near a doorway that a door swinging shut would hit. */
function inTheWay(world: World, door: OpenedDoor): Rect[] {
  const people = [world.player, ...world.guards.filter((guard) => guard.mode !== 'dead' && !guard.ragdoll)]
  const bodies = world.guards.flatMap((guard) => guard.ragdoll?.points.map((point) => ({ x: point.x - 0.15, y: point.y - 0.15, w: 0.3, h: 0.3 })) ?? [])
  const middle = door.tiles[0]
  const furniture = propsNear(world, { x: middle.x + 0.5, y: middle.y + 0.5 }, door.tiles.length + 2)
    .filter((prop) => !prop.broken && propSpec(prop.kind).mount === 'floor').map(propBox)
  const items = [...world.pickups, world.loot].filter((item) => !item.taken)
  return [...people, ...bodies, ...furniture, ...items, ...world.hazards.grenades, ...world.frags, ...world.charges]
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
