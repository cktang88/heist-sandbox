import { centerOf, distance } from '../types'
import type { World } from '../world'
import type { Finding } from './discoveries'
import { eyeOf, feetOf, type Guard } from './model'
import { clearView, zoneOf } from './perception'
import { floorBelow, roomOf } from './places'
import { raiseLevel, log } from './report'

/**
 * The case gone from its stand. An empty shelf means nothing to a passing patrol: only someone who knows the case
 * should be there (the man posted in its room, or an officer on his round) notices, standing in the room with a clear
 * view of the spot for a moment. Then it is a serious report: level 2, the exits locked and searched. It becomes a
 * confirmed intruder (level 3) if he is seen, or once the case has stayed missing a while.
 */

const CASE_SIGHT = 12
/** Looking at the empty spot this long before it sinks in. */
const LOOK_SECONDS = 1.5
/** Two checks further apart than this are two glances, not one look (far from the player a guard thinks once a second). */
const GLANCE_GAP = 1.6
/** The case still missing this long after the report: control confirms an intruder. */
export const CASE_CONFIRM_SECONDS = 90

const looks = new WeakMap<Guard, { since: number; last: number }>()

/** The case's room, if it stood in one. */
function caseRoom(world: World) {
  return roomOf(world, floorBelow(world, centerOf(world.loot)))
}

/** Does this guard know the case belongs there? The man posted in its room, or an officer. */
function knowsTheCase(guard: Guard, roomId: number | undefined): boolean {
  return guard.role === 'officer' || (roomId !== undefined && guard.roomId === roomId)
}

export function caseMissing(world: World, guard: Guard): Finding | null {
  if (world.security.vaultReported || !world.loot.taken) return null
  const room = caseRoom(world)
  const spot = centerOf(world.loot)
  const eye = eyeOf(guard)
  const looking = knowsTheCase(guard, room?.id) && roomOf(world, feetOf(guard))?.id === room?.id
    && distance(eye, spot) <= CASE_SIGHT && zoneOf(guard, eye, spot) === 'central' && clearView(world, eye, spot)
  if (!looking) {
    looks.delete(guard)
    return null
  }
  const look = looks.get(guard)
  if (!look || world.clock - look.last > GLANCE_GAP) {
    looks.set(guard, { since: world.clock, last: world.clock })
    return null
  }
  look.last = world.clock
  if (world.clock - look.since < LOOK_SECONDS) return null
  world.security.vaultReported = true
  const at = floorBelow(world, spot)
  return { at, kind: 'tamper', priority: 6, line: 'vaultOpen', tamper: 'lock', report: { kind: 'vault', at, by: world.guards.indexOf(guard) } }
}

/** A few times a second: the case reported missing long enough ago, and still gone, confirms the intruder. */
export function confirmMissingCase(world: World): void {
  const security = world.security
  if (!Number.isFinite(security.caseMissingAt) || security.level >= 3 || !world.loot.taken) return
  if (world.clock - security.caseMissingAt < CASE_CONFIRM_SECONDS) return
  log(world, 'Control: The case is still missing. Treat it as theft.')
  raiseLevel(world, 3)
}
