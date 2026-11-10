import { throwGrenade } from '../hazards/hazards'
import { nextHop } from '../nav'
import type { Vec } from '../types'
import { hasLineOfSight, normalize } from '../vision'
import type { World } from '../world'
import { barkLine } from './barks'
import type { KillZone } from './events'
import { eyeOf, feetOf, type Guard } from './model'
import { hold } from './movement'
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

/** A thrown flashbang or smoke grenade pops after about this long; the zone is passable from then. */
const POP_SECONDS = 1.4

/**
 * A fighting guard about to walk into a kill zone on his way to `goal` stops short of it. If he can, he throws a
 * flashbang or smoke grenade through it first (said out loud) and goes once it has popped; otherwise he waits there,
 * covering it, until someone has cleared it or it has gone quiet. Returns true while he is held up.
 */
export function respectKillZones(world: World, guard: Guard, goal: Vec, dt: number): boolean {
  const feet = feetOf(guard)
  const hop = nextHop(world.stairwells, feet, goal)
  const zone = zoneAhead(world, guard, hop.kind === 'walk' ? hop.x : feet.x)
  if (!zone || Math.abs(zone.at.x - feet.x) > KILL_ZONES.throwReach) return false
  if (world.clock < zone.clearedAt) {
    // Something is already on its way through: wait for it to pop.
    hold(world, guard, dt)
    return true
  }
  if (world.clock - guard.clearedAt > KILL_ZONES.throwEvery && hasLineOfSight(world.grid, eyeOf(guard), { x: zone.at.x, y: zone.at.y - 1 })) {
    clearWithGrenade(world, guard, zone)
    hold(world, guard, dt)
    return true
  }
  // Nothing to throw: hold at the edge, watching it.
  if (Math.abs(zone.at.x - feet.x) < KILL_ZONES.radius + 1.5) {
    barkLine(world, guard, 'killZone')
    hold(world, guard, dt)
    guard.facing = zone.at.x > feet.x ? 1 : -1
    return true
  }
  return false
}

function clearWithGrenade(world: World, guard: Guard, zone: KillZone): void {
  const eye = eyeOf(guard)
  const kind = world.rng() < 0.65 ? 'flash' : 'smoke'
  // Lobbed to land just beyond the middle of the zone.
  const side = Math.sign(zone.at.x - eye.x) || guard.facing
  const target = { x: zone.at.x + side, y: zone.at.y - 1 }
  const dx = target.x - eye.x
  throwGrenade(world, kind, eye, normalize(dx, target.y - eye.y - Math.abs(dx) * 0.35), 'guard')
  barkLine(world, guard, kind === 'flash' ? 'flashOut' : 'smokeOut', true)
  guard.clearedAt = world.clock
  zone.clearedAt = world.clock + POP_SECONDS
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
    && zone.at.x + KILL_ZONES.radius > low && zone.at.x - KILL_ZONES.radius < high && !recentlyCleared(world, zone))
}

/** A grenade went through it moments ago (or is about to pop there). */
function recentlyCleared(world: World, zone: KillZone): boolean {
  return world.clock >= zone.clearedAt && world.clock - zone.clearedAt < KILL_ZONES.clearedSeconds
}
