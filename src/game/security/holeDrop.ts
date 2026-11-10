import { guardWantsToDrop, nearestHole } from '../gaps/gaps'
import { throwGrenade } from '../hazards/hazards'
import type { HoleFinder } from '../nav'
import type { Vec } from '../types'
import { normalize } from '../vision'
import type { World } from '../world'
import { barkLine } from './barks'
import { fireAt } from './combat'
import { liveKillZones } from './killZones'
import { roundReaches, GUARD_PISTOL, GUARD_RIFLE } from './lineOfFire'
import { eyeOf, feetOf, type Guard } from './model'
import { floorBelow, roomOf, sameFloor } from './places'
import { COMBAT, KILL_ZONES } from './tuning'

/**
 * Holes blasted in a floor as a way down for guards in a hurry (nav.ts plans the route; gaps/ carries people across or
 * lets them fall). Before a fighting guard drops on a man he knows is below, he softens the room up first: a flashbang
 * down the hole if he carries one, or rounds through it. Nobody drops into a room where colleagues were just cut down.
 * Calm guards never use holes: their patrol routes walk past them.
 */

/** How far along his floor a guard looks for a hole to drop through. */
const HOLE_REACH = 40
/** A cached hole stays good while he has moved less than this since it was found (and nothing in the grid changed). */
const CACHE_SLACK = 3
/** A flashbang dropped down the hole pops after about this long; then he follows it. */
const FLASH_POP = 1.4
/** Rounds he puts down the hole before going. */
const SOFTEN_SECONDS = 1.2
/** A man last placed below him this recently counts as known to be down there. */
const KNOWN_FOR = 8

type Cached = { version: number; floorY: number; x: number; hole: number | null }
const cache = new WeakMap<Guard, Cached>()

/** The holes this guard may drop through: the nearest on his floor whose landing is not a kill zone. Cached between grid changes. */
export function holesFor(world: World, guard: Guard): HoleFinder {
  return (floorY, x) => {
    const known = cache.get(guard)
    if (known && known.version === world.grid.version && known.floorY === floorY && Math.abs(known.x - x) < CACHE_SLACK) return known.hole
    const column = nearestHole(world, floorY, x, HOLE_REACH)
    const hole = column !== null && !landsInKillZone(world, column, floorY) ? column : null
    cache.set(guard, { version: world.grid.version, floorY, x, hole })
    return hole
  }
}

/** Where someone dropping through the hole at this column of slab row `floorY` lands. */
export function landingUnder(world: World, column: number, floorY: number): Vec {
  return floorBelow(world, { x: column + 0.5, y: floorY + 1 })
}

/** Would dropping here put him where colleagues were just killed: the same room below, or close to the spot? */
export function landsInKillZone(world: World, column: number, floorY: number): boolean {
  const landing = landingUnder(world, column, floorY)
  const room = roomOf(world, landing)
  return liveKillZones(world).some((zone) => sameFloor(zone.at, landing)
    && ((room !== undefined && roomOf(world, zone.at) === room) || Math.abs(zone.at.x - landing.x) < KILL_ZONES.radius * 2))
}

/**
 * Standing at the edge of the hole he means to drop through. A fighting guard who knows the man is below softens the room
 * up first (a flashbang if he carries one, or rounds down through the hole) and then goes. Returns true once he may step in.
 */
export function readyToDrop(world: World, guard: Guard, holeX: number): boolean {
  const column = Math.floor(holeX)
  const floorY = Math.round(feetOf(guard).y)
  const prep = guard.dropPrep
  if (prep && prep.x === column && prep.y === floorY) {
    if (world.clock >= prep.readyAt) return true
    if (!prep.flashed) fireDown(world, guard, column, floorY)
    return false
  }
  const known = manBelow(world, guard, floorY)
  if (!known) return true
  const flash = guard.armored && guard.flashCooldown <= 0
  guard.dropPrep = { x: column, y: floorY, readyAt: world.clock + (flash ? FLASH_POP : SOFTEN_SECONDS), flashed: flash }
  if (flash) {
    const eye = eyeOf(guard)
    throwGrenade(world, 'flash', eye, normalize(holeX - eye.x, 1.2), 'guard')
    guard.flashCooldown = COMBAT.flashCooldown
    barkLine(world, guard, 'flashOut', true)
  } else barkLine(world, guard, 'holeDown', true)
  return false
}

/** Rounds down through the hole: at the man if a round could reach where he was seen, otherwise into the room under it. */
function fireDown(world: World, guard: Guard, column: number, floorY: number): void {
  const eye = eyeOf(guard)
  const known = guard.lastKnown
  const power = guard.armored ? GUARD_RIFLE : GUARD_PISTOL
  const landing = landingUnder(world, column, floorY)
  const at = known && roundReaches(world, eye, known, power) ? known : { x: landing.x, y: landing.y - 1 }
  guard.aim = normalize(at.x - eye.x, at.y - eye.y)
  fireAt(world, guard, at)
}

/** The man's last known position, when he is fighting and it is on a storey below this floor and fresh. */
function manBelow(world: World, guard: Guard, floorY: number): Vec | null {
  const known = guard.lastKnown
  if (guard.mode !== 'combat' || !known || world.clock - guard.lastKnownAt > KNOWN_FOR) return null
  return known.y > floorY + 1 ? known : null
}

/**
 * Whether a guard over a walk-past hole goes down through it (gaps/ asks, after everyone has moved): he must be in a
 * hurry for somewhere below, never into a kill zone, and not before he has finished softening up the room.
 */
export function guardDropsThrough(world: World, guard: Guard, floorY: number): boolean {
  if (!guardWantsToDrop(guard, floorY)) return false
  const column = Math.floor(feetOf(guard).x)
  if (landsInKillZone(world, column, floorY)) return false
  const prep = guard.dropPrep
  if (prep && prep.y === floorY && world.clock < prep.readyAt) return false
  if (prep && prep.y === floorY) {
    barkLine(world, guard, 'dropping', true)
    guard.dropPrep = null
  }
  return true
}
