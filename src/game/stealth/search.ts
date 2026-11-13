import type { PropState } from '../cover'
import type { Guard } from '../guards'
import { bark } from '../security/barks'
import { noticeBody } from '../security/brain'
import { enterCombat } from '../security/combat'
import { confront } from '../security/startle'
import { centerOf, type Vec } from '../types'
import { hasLineOfSight } from '../vision'
import type { World } from '../world'
import { layBodyAt } from './bodies'
import { leaveSpot } from './hide'
import { bodiesIn, spotFeet, spotKind, spotsAround } from './spots'
import { HIDE } from './tuning'

/**
 * Guards opening hiding places: one who saw the player climb in, and searchers on a raised alert who look in the
 * lockers and under the desks around the spot they were sent to. Calm patrols never do. Whatever is inside comes out:
 * the player is face to face with him (the surprise window, if he is alone), bodies tumble out and are found.
 */

/** How long an opened hiding place counts as checked. */
const CHECKED_FOR = 60

export function openSpot(world: World, guard: Guard, prop: PropState): void {
  world.stealth.opened.set(prop.id, world.clock)
  guard.facing = spotFeet(prop).x >= guard.x + guard.w / 2 ? 1 : -1
  if (world.stealth.hiding?.prop === prop.id) {
    leaveSpot(world)
    if (!confront(world, guard)) {
      world.stats.timesSpotted += 1
      enterCombat(world, guard, centerOf(world.player))
    }
    return
  }
  const bodies = bodiesIn(world, prop)
  if (bodies.length === 0) return
  const front = spotFeet(prop)
  bodies.forEach((index, order) => {
    const body = world.guards[index]
    body.hiddenIn = null
    layBodyAt(body, { x: front.x + order * 0.6, y: front.y }, guard.facing)
  })
  bark(world, guard, spotKind(prop.kind)?.how === 'under' ? "There's someone under here!" : "Oh god, there's a body in here!", true)
  noticeBody(world, guard, bodies[0])
}

/**
 * A searcher at one of his stops looks in the hiding places nearest it: more of them for a veteran. Only on a raised
 * alert (level 2 or more), or when blood led him here.
 */
export function searchSpotsNear(world: World, guard: Guard, at: Vec, force = false): void {
  if (!force && world.security.level < 2) return
  let checks = HIDE.checks[guard.tier]
  for (const prop of spotsAround(world, at, HIDE.searchRadius)) {
    if (checks <= 0) return
    const kind = spotKind(prop.kind)!
    // A gap behind a shelf is only looked at with a torch; a calm look misses it.
    if (kind.how === 'behind' && !force) continue
    if (world.clock - (world.stealth.opened.get(prop.id) ?? -Infinity) < CHECKED_FOR) continue
    // Only the places he can get at from his stop: never one in the next room through a wall, or across a shaft.
    const spot = spotFeet(prop)
    if (!hasLineOfSight(world.grid, { x: at.x, y: at.y - 1 }, { x: spot.x, y: spot.y - 1 })) continue
    checks -= 1
    openSpot(world, guard, prop)
    if (guard.mode === 'combat' || guard.startle || guard.interest?.kind === 'body') return
  }
}
