import type { Guard } from '../guards'
import type { World } from '../world'
import { bodyAt } from './bodies'
import { CARRY } from './tuning'

/**
 * Blood: a pool where a man was killed, and drops along the way if his body is carried off. Guards notice it like an
 * open door (see security/traces.ts), and it leads them to whatever was hidden nearby.
 */

/** A kill leaves a pool under the body, and the body bleeds a few drops more when it is moved. */
export function addBloodPool(world: World, guard: Guard): void {
  const index = world.guards.indexOf(guard)
  const at = bodyAt(guard)
  world.stealth.blood.push({ x: at.x, y: guard.y + guard.h, noticed: false })
  world.stealth.bleeding.set(index, CARRY.bloodDrops)
}
