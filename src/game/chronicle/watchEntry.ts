import { isOutdoors } from '../director/conditions/rain'
import { feetOf } from '../security/model'
import { roomOf } from '../security/places'
import { changeMark, changesFrom, TILE_KINDS } from '../tiles'
import { distance, type Vec } from '../types'
import type { World } from '../world'
import { note } from './note'
import type { Opening } from './types'

/**
 * How the player got in. Until he is first inside a building, the tiles that change near him are remembered with what
 * they used to be (a copy of the tile kinds is kept for just that long); when he steps inside, the latest opening
 * close by says how: a window, a door, or a hole in the wall.
 */

const NEAR = 8
const RECENT = 6
const KEEP = 12
const KIND = Object.fromEntries(TILE_KINDS.map((kind, index) => [kind, index])) as Record<(typeof TILE_KINDS)[number], number>

export function watchEntry(world: World): void {
  const entry = world.chronicle.entry
  if (world.chronicle.player.inside) return
  const grid = world.grid
  if (!entry.kinds) {
    entry.kinds = grid.kinds.slice()
    entry.mark = changeMark(grid)
  }
  readChanges(world)
  const feet = feetOf(world.player)
  if (!world.player.onGround || !isInside(world, feet)) return
  world.chronicle.player.inside = true
  note(world, 'entered', feet, { detail: howIn(world) })
  entry.kinds = null
  entry.openings = []
}

const OPEN_AIR = new Set(['rooftop', 'street', 'yard'])

/** Inside a building: under a roof, and not in one of the open-air "rooms" (a roof deck, the street, the yard). */
export function isInside(world: World, feet: Vec): boolean {
  if (isOutdoors(world, feet)) return false
  const room = roomOf(world, feet)
  return !room || !OPEN_AIR.has(room.kind)
}

function readChanges(world: World): void {
  const entry = world.chronicle.entry
  const grid = world.grid
  const kinds = entry.kinds!
  const start = changesFrom(grid, entry.mark)
  entry.mark = changeMark(grid)
  if (start < 0) return
  const feet = feetOf(world.player)
  const tiles = grid.changes.tiles
  for (let index = start; index < tiles.length; index += 1) {
    const tile = tiles[index]
    const from = kinds[tile]
    const to = grid.kinds[tile]
    kinds[tile] = to
    const at = { x: (tile % grid.width) + 0.5, y: Math.floor(tile / grid.width) + 0.5 }
    if (from === to || distance(at, feet) > NEAR) continue
    entry.openings.push({ ...at, t: world.clock, from, to })
    if (entry.openings.length > KEEP) entry.openings.shift()
  }
}

/** The most recent opening near where he came in, in words. */
export function howIn(world: World): string {
  const feet = feetOf(world.player)
  if (feet.y > world.groundY + 1) return 'sewer'
  const openings = world.chronicle.entry.openings.filter((opening) => world.clock - opening.t <= RECENT && distance(opening, feet) <= NEAR / 2 + 1)
  const latest = (test: (opening: Opening) => boolean) => openings.some(test)
  if (latest((opening) => opening.from === KIND.glass)) return 'window'
  if (latest((opening) => opening.from === KIND.door)) return 'door'
  if (latest((opening) => opening.to === KIND.air && opening.from !== KIND.ladder)) {
    const blast = world.chronicle.destruction.lastBlast
    return blast && world.clock - blast.t <= RECENT && distance(blast, feet) < NEAR ? 'blast' : 'drill'
  }
  if (world.grapple.phase === 'attached' || world.grapple.phase === 'parked') return 'grapple'
  if (world.ropes.length > 0) return 'rope'
  return 'open'
}
