import type { Guard } from '../guards'
import { isAlerted } from '../security/perception'
import { roomAt, type RoomKind } from '../site'
import { TOOLS } from '../toolDefs'
import { centerOf } from '../types'
import type { World } from '../world'
import { DISGUISE } from './tuning'

/**
 * Wearing a guard's uniform. From a distance, in passing, the player reads as one of them; up close a guard looks at
 * his face and sees through it after a moment. Officers know every face. Running, carrying a body, choking a man or
 * holding one as a shield, holding a big gun or walking into a room his rank has no business in gives him away
 * whatever the distance. Once a stripped body has been found, everyone looks harder for a while.
 */

const BIG_GUNS = new Set(['rifle', 'shotgun', 'sniper', 'rocket'])
const RESTRICTED: ReadonlySet<RoomKind> = new Set(['vault', 'security', 'armory', 'server'])

/** Why the uniform is not working right now, or null if it is (or there is none). */
export function disguiseBlown(world: World): string | null {
  const disguise = world.stealth.disguise
  if (!disguise) return null
  const player = world.player
  if (Math.abs(player.vx) > 5) return 'running'
  if (world.stealth.carried !== null) return 'carrying a body'
  if (world.stealth.choke) return 'choking a man'
  if (world.melee.shield) return 'holding a hostage'
  if (BIG_GUNS.has(TOOLS[player.tool].id) && !TOOLS[player.tool].action) return 'big gun out'
  const at = centerOf(player)
  const room = roomAt(world.rooms, at.x, at.y)
  if (room && RESTRICTED.has(room.kind) && !disguise.officer) return 'restricted area'
  return null
}

/**
 * How much of the usual detection rate this guard gets against the disguised player at this distance: 1 without a
 * working disguise (or for an officer), less up close, little or nothing further off.
 */
export function disguiseFactor(world: World, guard: Guard, gap: number): number {
  if (!world.stealth.disguise || guard.role === 'officer' || disguiseBlown(world)) return 1
  if (gap < DISGUISE.close) return DISGUISE.closeFactor
  if (world.clock - world.stealth.uniformKnownAt < DISGUISE.knownSeconds) return DISGUISE.knownFactor
  return isAlerted(guard) ? DISGUISE.edgeFactor : DISGUISE.calmFactor
}

/** Does a camera this far off take the disguised player for a guard? Close up the control room sees the face. */
export function fooledCamera(world: World, gap: number): boolean {
  return world.stealth.disguise !== null && disguiseBlown(world) === null && gap > DISGUISE.close * 2
}

export function takeUniform(world: World, guard: Guard): void {
  const index = world.guards.indexOf(guard)
  world.stealth.uniforms.add(index)
  world.stealth.disguise = { officer: guard.role === 'officer' }
}
