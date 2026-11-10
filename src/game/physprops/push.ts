import { scrapeNoise } from '../security/hearing'
import type { PropState } from '../cover'
import { propBox, propById, propCenter } from '../hazards/props'
import { boxHitsSolid } from '../physics'
import { playSound } from '../sounds'
import { centerOf } from '../types'
import type { World } from '../world'
import { isSupported } from './gravity'
import { isPushable, weightOf } from './kinds'
import { propsAround } from './nearby'
import { capPlayerSpeed } from './pace'
import { loosen, rekeyIfMoved, shiftProp } from './state'

/**
 * Hold grab beside a piece of furniture and walk: it comes along, pushed or dragged, at a pace set by its weight,
 * scraping loudly enough for guards nearby to come and look. It stops at walls and doors, and if its middle
 * goes out over a hole it is let go and falls.
 */

/** How far from the player's side a prop can be and still be taken hold of. */
const GRAB_REACH = 0.35
const SAME_FLOOR = 0.3
/** Drag pace for a prop of weight 1; heavier things go slower, within these limits. */
const DRAG_PACE = 5.5
const MIN_DRAG_SPEED = 1.2
const MAX_DRAG_SPEED = 5
const SCRAPE_EVERY = 0.6
const SEARCH_RADIUS = 4

export function dragSpeed(prop: PropState): number {
  return Math.max(MIN_DRAG_SPEED, Math.min(MAX_DRAG_SPEED, DRAG_PACE / weightOf(prop.kind)))
}

export function dragFurniture(world: World, grab: boolean, dt: number): void {
  const state = world.physProps
  const held = state.grabbed ? propById(world, state.grabbed.id) : undefined
  if (!grab || !world.player.onGround || world.melee.shield || !held || held.broken) {
    if (held) letGo(world, held)
    state.grabbed = null
    if (grab && world.player.onGround && !world.melee.shield) takeHold(world)
    return
  }
  drag(world, held, state.grabbed!.offset, dt)
}

function takeHold(world: World): void {
  const prop = pushableInReach(world)
  if (!prop) return
  loosen(world, prop)
  world.physProps.grabbed = { id: prop.id, offset: propBox(prop).x - world.player.x }
}

/** The pushable prop standing on the player's floor closest to his side, if one is within reach. */
export function pushableInReach(world: World, side: 0 | 1 | -1 = 0): PropState | null {
  const player = world.player
  const feet = player.y + player.h
  let best: PropState | null = null
  let bestGap = GRAB_REACH
  for (const prop of propsAround(world, centerOf(player), SEARCH_RADIUS)) {
    if (!isPushable(prop.kind)) continue
    const box = propBox(prop)
    if (Math.abs(box.y + box.h - feet) > SAME_FLOOR || !isSupported(world.grid, prop)) continue
    const right = box.x - (player.x + player.w)
    const left = player.x - (box.x + box.w)
    if ((side > 0 && left > 0) || (side < 0 && right > 0)) continue
    const gap = Math.max(right, left, 0)
    if (gap > bestGap || (best && gap === bestGap)) continue
    best = prop
    bestGap = gap
  }
  return best
}

function drag(world: World, prop: PropState, offset: number, dt: number): void {
  const player = world.player
  capPlayerSpeed(world, dragSpeed(prop), dt)
  const box = propBox(prop)
  const dx = player.x + offset - box.x
  if (dx === 0) return
  if (boxHitsSolid(world.grid, { ...box, x: box.x + dx })) {
    // Wedged against a wall or door: the player cannot walk on through it either.
    const back = box.x - offset
    if (!boxHitsSolid(world.grid, { ...player, x: back })) player.x = back
    player.vx = 0
    return
  }
  shiftProp(prop, dx, 0)
  scrape(world, prop, Math.abs(dx))
  const loose = loosen(world, prop)
  if (!isSupported(world.grid, prop)) {
    letGo(world, prop)
    world.physProps.grabbed = null
    return
  }
  rekeyIfMoved(world, prop, loose, false)
}

function scrape(world: World, prop: PropState, distance: number): void {
  const state = world.physProps
  state.scraped += distance
  if (state.scraped < SCRAPE_EVERY) return
  state.scraped = 0
  const center = propCenter(prop)
  playSound(world, 'impact', center)
  scrapeNoise(world, center)
}

function letGo(world: World, prop: PropState): void {
  rekeyIfMoved(world, prop, loosen(world, prop), true)
}
