import type { DeviceSpawn, Room } from '../site'
import { tileAt, type Grid } from '../tiles'

/**
 * The ways into a room a quiet player can use, read from the tiles: its doorways (open, behind a keypad, or with a
 * lock to pick), a duct grate in its ceiling, a window in its outer wall, a hatch in its floor or ceiling.
 * The generator uses it to give the rooms the case can be in a second way in; the stealth checks use it to verify.
 */

export type Access = 'doorway' | 'open doorway' | 'keypad door' | 'duct grate' | 'window' | 'hatch'

const DOOR_ROWS = 3

/** A doorway in one of a room's side walls, shut or open. */
export type Doorway = { x: number; floorY: number; open: boolean }

export function doorwaysOf(grid: Grid, room: Room): Doorway[] {
  const out: Doorway[] = []
  for (const x of [room.x - 1, room.x + room.w]) {
    const rows = Array.from({ length: DOOR_ROWS }, (_, index) => tileAt(grid, x, room.floorY - 1 - index))
    if (rows.every((kind) => kind === 'door')) out.push({ x, floorY: room.floorY, open: false })
    else if (rows.every((kind) => kind === 'air')) out.push({ x, floorY: room.floorY, open: true })
  }
  return out
}

function keypadAt(devices: readonly DeviceSpawn[], door: Doorway): boolean {
  return devices.some((device) => device.kind === 'keypad' && typeof device.target === 'object' && device.target.x === door.x && device.target.y === door.floorY - 1)
}

/** A hatch: a door tile in a slab with a ladder under it, here in the room's floor or ceiling. */
function hasHatch(grid: Grid, room: Room): boolean {
  for (let x = room.x; x < room.x + room.w; x += 1) {
    for (const slab of [room.floorY, room.y - 1]) if (tileAt(grid, x, slab) === 'door' && tileAt(grid, x, slab + 1) === 'ladder') return true
  }
  return false
}

function hasGrate(grid: Grid, room: Room): boolean {
  const row = room.y + 1
  for (let x = room.x; x < room.x + room.w; x += 1) {
    if (tileAt(grid, x, row) === 'air' && (tileAt(grid, x - 1, row) === 'duct' || tileAt(grid, x + 1, row) === 'duct')) return true
  }
  return false
}

export function quietWaysInto(grid: Grid, devices: readonly DeviceSpawn[], room: Room): Access[] {
  const ways: Access[] = doorwaysOf(grid, room).map((door) => (door.open ? 'open doorway' : keypadAt(devices, door) ? 'keypad door' : 'doorway'))
  if (hasGrate(grid, room)) ways.push('duct grate')
  if (hasHatch(grid, room)) ways.push('hatch')
  for (const x of [room.x - 1, room.x + room.w]) {
    if ([2, 3, 4].some((up) => tileAt(grid, x, room.floorY - up) === 'glass')) ways.push('window')
  }
  return ways
}
