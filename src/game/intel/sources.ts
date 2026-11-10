import { propById, propsAt } from '../hazards/props'
import { propSpec, type PropKind } from '../propCatalog'
import { sayAt } from '../security/barks'
import type { RoomKind } from '../site'
import { centerOf, distance } from '../types'
import type { Device, World } from '../world'
import { recordClue, WRITTEN_TRUTH } from './clues'
import { writtenLine } from './describe'
import type { IntelAction } from './interrogate'
import type { Clue, Detail } from './types'

/**
 * The quiet sources, which reward not being seen: papers pinned up around offices and security rooms,
 * and the files on a hacked computer. Written sources are more reliable than people.
 */

const READABLE: readonly PropKind[] = ['whiteboard', 'noticeBoard', 'paperStack']
/** Rooms where a note about the case could plausibly be pinned up. */
const INFORMED: readonly RoomKind[] = ['security', 'office', 'executive', 'archive', 'conference', 'server', 'lab', 'armory', 'storage', 'loadingDock', 'barracks', 'lockers', 'cells']
/** Rooms whose papers and computers know exactly which room. */
const IN_THE_KNOW: readonly RoomKind[] = ['security', 'executive', 'archive']
/** How many papers on a site say something useful. The rest are rotas and memos. */
const USEFUL_DOCUMENTS = 8
const READ_REACH = 2
const READ_SECONDS = 1.2
const MUNDANE = ['A cleaning rota.', 'Fire drill: Thursday.', 'Someone wants their stapler back.', 'Canteen menu. Fish again.', 'Shift swaps. Nothing useful.']

/** Picks which papers hold something useful, spread over the rooms that might know. */
export function chooseDocuments(world: World): Set<number> {
  const pool = world.props.filter((prop) => READABLE.includes(prop.kind) && INFORMED.includes(roomKindOf(world, prop.roomId) ?? 'street'))
  const chosen = new Set<number>()
  while (chosen.size < Math.min(USEFUL_DOCUMENTS, pool.length)) chosen.add(pool[Math.floor(world.rng() * pool.length)].id)
  return chosen
}

/**
 * The nearest unread paper in reach. Its reading point is the middle of the prop, which lies in a tile the prop covers,
 * so only the props filed under the tiles in reach are asked, not every prop on the site. Of two equally near, the
 * one listed first wins, as when every prop was asked in order.
 */
export function readAction(world: World): IntelAction | null {
  if (world.intel.places.length === 0) return null
  const center = centerOf(world.player)
  let best: World['props'][number] | null = null
  let bestGap = READ_REACH
  const reach = Math.ceil(READ_REACH)
  for (let y = Math.floor(center.y) - reach; y <= Math.floor(center.y) + reach; y += 1) {
    for (let x = Math.floor(center.x) - reach; x <= Math.floor(center.x) + reach; x += 1) {
      for (const id of propsAt(world, x, y)) {
        const prop = propById(world, id)
        if (!prop || prop.broken || !READABLE.includes(prop.kind)) continue
        const spec = propSpec(prop.kind)
        const gap = distance(center, { x: prop.x + 0.5, y: spec.mount === 'floor' ? prop.y - spec.h / 2 : prop.y + spec.h / 2 })
        if (gap > bestGap || (gap === bestGap && (best === null || prop.id >= best.id)) || world.intel.used.has(`prop:${prop.id}`)) continue
        best = prop
        bestGap = gap
      }
    }
  }
  if (!best) return null
  const prop = best
  return { prompt: 'Hold E: read', key: `intel:read:${prop.id}`, hold: READ_SECONDS, run: () => readProp(world, prop) }
}

/** Reads a paper. A useful one adds a clue; the rest show what they are, so the player can move on. */
export function readProp(world: World, prop: World['props'][number]): Clue | null {
  world.intel.used.add(`prop:${prop.id}`)
  const above = { x: world.player.x + world.player.w / 2, y: world.player.y - 0.5 }
  if (!world.intel.documents.has(prop.id)) {
    sayAt(world, above, MUNDANE[prop.id % MUNDANE.length])
    return null
  }
  const room = roomKindOf(world, prop.roomId)
  const clue = recordClue(world, { source: 'document', origin: prop.kind === 'whiteboard' ? 'whiteboard' : 'note', sourceKey: `prop:${prop.id}`, detail: writtenDetail(room), truth: WRITTEN_TRUTH })
  sayAt(world, above, writtenLine(clue.filter, 'note'))
  return clue
}

/**
 * The clue in a hacked computer's files: a duty roster in rooms that know, a shipping manifest elsewhere.
 * Each computer gives one clue; null when it has already been searched (or the site has nothing to find).
 */
export function terminalClue(world: World, device: Device): Clue | null {
  const key = `device:${device.id}`
  if (world.intel.places.length === 0 || device.kind !== 'computer' || world.intel.used.has(key)) return null
  world.intel.used.add(key)
  const room = roomKindOf(world, device.roomId)
  const roster = room !== undefined && IN_THE_KNOW.includes(room)
  return recordClue(world, { source: 'terminal', origin: roster ? 'duty roster' : 'shipping manifest', sourceKey: key, detail: writtenDetail(room), truth: WRITTEN_TRUTH })
}

/** The words a terminal clue is shown with. */
export function terminalLine(clue: Clue): string {
  return writtenLine(clue.filter, clue.origin === 'duty roster' ? 'roster' : 'manifest')
}

function writtenDetail(room: RoomKind | undefined): Detail {
  if (room === 'security') return 'room'
  return room !== undefined && IN_THE_KNOW.includes(room) ? 'kind' : 'band'
}

function roomKindOf(world: World, roomId: number | undefined): RoomKind | undefined {
  return roomId === undefined ? undefined : world.rooms.find((room) => room.id === roomId)?.kind
}
