import type { Vec } from '../types'
import type { World } from '../world'
import type { KillZone } from './events'
import { feetOf, type Guard } from './model'
import { sameFloor } from './places'
import { KILL_ZONES } from './tuning'

/**
 * Where colleagues have been cut down. A guard killed at a spot makes it a kill zone for a while: the next ones
 * do not walk into the same doorway or stair head one after another. Kill zones that keep claiming men are what
 * bring in the shield team (shieldTeam.ts).
 */

/** A guard died here: start a kill zone, or add to the one he died in. */
export function markKillZone(world: World, victim: Guard): void {
  const at = feetOf(victim)
  const zone = zoneAt(world, at)
  if (zone) {
    zone.deaths += 1
    zone.lastDeath = world.clock
    return
  }
  world.security.killZones.push({ at, deaths: 1, lastDeath: world.clock, clearedAt: -Infinity })
}

/** Kill zones still fresh enough to fear. Old ones are dropped. */
export function liveKillZones(world: World): KillZone[] {
  const zones = world.security.killZones
  if (zones.some((zone) => world.clock - zone.lastDeath > KILL_ZONES.seconds)) {
    world.security.killZones = zones.filter((zone) => world.clock - zone.lastDeath <= KILL_ZONES.seconds)
  }
  return world.security.killZones
}

/** The live kill zone covering this feet position, if any. */
export function zoneAt(world: World, feet: Vec): KillZone | undefined {
  return liveKillZones(world).find((zone) => sameFloor(zone.at, feet) && Math.abs(zone.at.x - feet.x) < KILL_ZONES.radius)
}

/**
 * The live kill zone a guard would walk into going from his feet toward `toX` on his floor (not one he is already
 * standing in: he should get out of that). Recently cleared zones (a grenade went through) do not count.
 */
export function zoneAhead(world: World, guard: Guard, toX: number): KillZone | undefined {
  const feet = feetOf(guard)
  const low = Math.min(feet.x, toX)
  const high = Math.max(feet.x, toX)
  return liveKillZones(world).find((zone) => sameFloor(zone.at, feet) && Math.abs(zone.at.x - feet.x) >= KILL_ZONES.radius
    && zone.at.x + KILL_ZONES.radius > low && zone.at.x - KILL_ZONES.radius < high && world.clock - zone.clearedAt > KILL_ZONES.clearedSeconds)
}
