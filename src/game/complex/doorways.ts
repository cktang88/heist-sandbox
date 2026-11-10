import { createRng, type Rng } from '../rng'
import type { Room } from '../site'
import { tileAt } from '../tiles'
import { chance, fill, type SiteDraft } from './kit'

/**
 * How the doorways between rooms are finished, once every room is laid out. Every door the player picks stays open
 * and a guard who finds it calls in a forced lock, so the route through a building cannot be all locked doors:
 * - most stair lobbies open onto ordinary rooms through an open archway (a propped fire door), so taking the stairs
 *   leaves no trace, and about half the doors between ordinary rooms are open archways too;
 * - secure rooms (security office, armoury, server room, cells, executive suites) are shut behind keypad doors,
 *   which a patient player hacks quietly instead of forcing the lock.
 * The vault has its own keypad doors already. This runs after the ducts, so they are laid exactly as before; a duct
 * floor over a doorway made an archway still rests on the brick lintel above it.
 */

const OPEN_LOBBY_ODDS = 0.9
/** On top of the archways the floor plan already has (block.ts), so about half of all ordinary doorways are open. */
const OPEN_ROOM_ODDS = 0.5
const OUTDOOR = new Set(['grounds', 'sewer', 'silo', 'gatehouse'])
const DOOR_ROWS = 3

/** Pairs of rooms side by side on one floor with a single wall between them. */
function neighbours(rooms: readonly Room[]): [Room, Room][] {
  const byFloor = new Map<string, Room[]>()
  for (const room of rooms) {
    if (OUTDOOR.has(room.building)) continue
    const key = `${room.building}:${room.floorY}`
    byFloor.set(key, [...(byFloor.get(key) ?? []), room])
  }
  const pairs: [Room, Room][] = []
  for (const floor of byFloor.values()) {
    const sorted = [...floor].sort((a, b) => a.x - b.x)
    for (let index = 1; index < sorted.length; index += 1) {
      const [a, b] = [sorted[index - 1], sorted[index]]
      if (b.x === a.x + a.w + 1) pairs.push([a, b])
    }
  }
  return pairs
}

function isDoorway(site: SiteDraft, wall: number, floorY: number): boolean {
  for (let row = floorY - DOOR_ROWS; row < floorY; row += 1) if (tileAt(site.grid, wall, row) !== 'door') return false
  return true
}

export function finishDoorways(site: SiteDraft): void {
  for (const [a, b] of neighbours(site.rooms)) {
    const wall = a.x + a.w
    if (a.kind === 'vault' || b.kind === 'vault' || !isDoorway(site, wall, a.floorY)) continue
    const secure = [a, b].filter((room) => room.security >= 2)
    // Between two secure rooms the door stays an ordinary locked one: there is no outside to hang a keypad on.
    if (secure.length === 2) continue
    if (secure.length === 1) {
      // The keypad hangs on the outside, by the door, where someone coming to the room reaches it.
      const inside = secure[0]
      const x = wall + (inside === a ? 1 : -1)
      // A step higher if a light switch already sits at hand height there.
      const y = site.devices.some((device) => device.x === x && device.y === a.floorY - 2) ? a.floorY - 3 : a.floorY - 2
      site.devices.push({ kind: 'keypad', x, y, roomId: inside.id, target: { x: wall, y: a.floorY - 1 } })
      continue
    }
    const odds = a.kind === 'stairwell' || b.kind === 'stairwell' ? OPEN_LOBBY_ODDS : OPEN_ROOM_ODDS
    if (chance(doorwayRng(wall, a.floorY), odds)) fill(site, wall, a.floorY - DOOR_ROWS, wall, a.floorY - 1, 'air')
  }
}

/**
 * Each doorway's own dice, from where it is: finishing the doorways never draws on the site's stream, so the rest of
 * the site (patrols, furniture, ducts) comes out as it would without it.
 */
function doorwayRng(wall: number, floorY: number): Rng {
  return createRng(wall * 7919 + floorY * 104729)
}
