import { bark } from '../security/barks'
import { isActive } from '../security/model'
import { centerOf, distance, type Vec } from '../types'
import type { World } from '../world'
import { markAllStale } from './clues'
import { putLootIn } from './places'
import type { Place } from './types'

/**
 * Why going loud loses the case: once the alarm is confirmed (site level 3+), security orders the case moved
 * to another of its candidate places. It is moved while nobody (the player) is watching either end, which is
 * simpler than a real carrier and reads the same from the player's side: everything learned goes stale.
 */

const MOVE_LEVEL = 3
/** Seconds of confirmed alarm before they decide to move it. */
const MOVE_DELAY = 20
/** After a move, a continuing alarm moves it again only after this much longer. */
const REARM_SECONDS = 60
const MAX_MOVES = 2
/** The player this close to either end sees it happen, so it waits. */
const WATCH_RANGE = 14

export function stepLootMove(world: World, dt: number): void {
  const intel = world.intel
  const move = intel.move
  if (world.loot.taken || intel.places.length < 2 || move.moves >= MAX_MOVES) return
  if (world.security.level < MOVE_LEVEL) {
    Object.assign(move, { alertSeconds: Math.min(0, move.alertSeconds), ordered: false, to: null })
    return
  }
  move.alertSeconds += dt
  if (move.alertSeconds < MOVE_DELAY) return
  if (move.to === null) orderMove(world)
  const to = intel.places[move.to ?? intel.real]
  if (watched(world, centerOf(world.loot)) || watched(world, spotOf(to))) return
  relocate(world, to)
}

/** The guard nearest the case calls it, so the player can hear that it is about to go. */
function orderMove(world: World): void {
  const intel = world.intel
  const others = intel.places.filter((place) => place.id !== intel.real)
  intel.move.to = others[Math.floor(world.rng() * others.length)].id
  intel.move.ordered = true
  const loot = centerOf(world.loot)
  const caller = world.guards.filter(isActive).sort((a, b) => distance(centerOf(a), loot) - distance(centerOf(b), loot))[0]
  if (caller) bark(world, caller, 'Move the package! Now!', true)
}

function watched(world: World, at: Vec): boolean {
  return distance(centerOf(world.player), at) < WATCH_RANGE
}

function spotOf(place: Place): Vec {
  return { x: place.x + place.w / 2, y: place.floorY - 1 }
}

export function relocate(world: World, to: Place): void {
  const intel = world.intel
  intel.real = to.id
  putLootIn(world, to)
  markAllStale(world)
  Object.assign(intel.move, { moves: intel.move.moves + 1, alertSeconds: -REARM_SECONDS, ordered: false, to: null })
}
