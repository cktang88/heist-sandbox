import type { Guard } from '../guards'
import { onLine } from '../grapple/state'
import { roomAt, type RoomKind } from '../site'
import { TOOLS } from '../toolDefs'
import { centerOf } from '../types'
import type { World } from '../world'

/** A uniform passes as a guard until the player does something suspicious. */

const BIG_GUNS = new Set(['rifle', 'shotgun', 'sniper', 'rocket'])
const RESTRICTED: ReadonlySet<RoomKind> = new Set(['vault', 'security', 'armory', 'server'])

/** Why the uniform is not working right now, or null if it is (or there is none). */
export function disguiseBlown(world: World): string | null {
  const disguise = world.stealth.disguise
  if (!disguise) return null
  const player = world.player
  if (world.clock < world.stealth.suspiciousUntil) return 'hostile action'
  // His ordinary pace is a guard's walk; sliding, jumping about and climbing are not how a guard moves.
  if (player.onLadder || player.mantle || onLine(world.grapple)) return 'climbing'
  if (player.slide > 0) return 'sliding'
  if (!player.onGround && !player.stairs) return 'jumping about'
  if (world.stealth.carried !== null) return 'carrying a body'
  if (world.stealth.choke) return 'choking a man'
  if (world.melee.shield) return 'holding a hostage'
  if (BIG_GUNS.has(TOOLS[player.tool].id) && !TOOLS[player.tool].action) return 'big gun out'
  const at = centerOf(player)
  const room = roomAt(world.rooms, at.x, at.y)
  if (room && RESTRICTED.has(room.kind) && !disguise.officer) return 'restricted area'
  return null
}

/** Proximity, rank and site alert alone do not expose a convincing uniform. */
export function disguiseFactor(world: World): number {
  return world.stealth.disguise && disguiseBlown(world) === null ? 0 : 1
}

/** Cameras use the same suspicious-behavior rules as guards. */
export function fooledCamera(world: World): boolean {
  return disguiseFactor(world) === 0
}

export function takeUniform(world: World, guard: Guard): void {
  const index = world.guards.indexOf(guard)
  world.stealth.uniforms.add(index)
  world.stealth.disguise = { officer: guard.role === 'officer' }
}
