import { hurtGuard } from '../guards'
import type { Body, Vec } from '../types'
import type { World } from '../world'
import { fireHeatAt } from './fire'
import { smokeDensityAt, toxicAt } from './smoke'

/** Damage per second at full heat or in fully toxic smoke. Guards take theirs through `hurtGuard`, which triples it for an unaware guard. */
const PLAYER_BURN = 18
const GUARD_BURN = 6
const PLAYER_CHOKE = 3
const GUARD_CHOKE = 1.5
/** Smoke thinner than this is unpleasant but harmless. */
const CHOKES_AT = 0.5

/** Hurts everyone standing in fire or thick fire smoke for `seconds`. Called a couple of times a second, not every frame. */
export function harmPeople(world: World, seconds: number): void {
  const hazards = world.hazards
  if (hazards.fires.size === 0 && !hazards.smoke?.active.size) return
  const player = world.player
  player.hp -= (PLAYER_BURN * burnOn(world, player) + PLAYER_CHOKE * chokeOn(world, player)) * seconds
  for (const guard of world.guards) {
    if (guard.state === 'dead') continue
    const damage = (GUARD_BURN * burnOn(world, guard) + GUARD_CHOKE * chokeOn(world, guard)) * seconds
    if (damage > 0) hurtGuard(world, guard, damage, { x: guard.x + guard.w / 2, y: guard.y + guard.h })
  }
}

/** The hottest fire touching a body, counting the floor under the feet at half strength. */
function burnOn(world: World, body: Body): number {
  if (world.hazards.fires.size === 0) return 0
  let heat = 0
  const x0 = Math.floor(body.x)
  const x1 = Math.floor(body.x + body.w - 0.001)
  const feet = Math.floor(body.y + body.h - 0.001)
  for (let x = x0; x <= x1; x += 1) {
    for (let y = Math.floor(body.y); y <= feet; y += 1) heat = Math.max(heat, fireHeatAt(world, x, y))
    heat = Math.max(heat, fireHeatAt(world, x, feet + 1) * 0.5)
  }
  return heat
}

function chokeOn(world: World, body: Body): number {
  const head: Vec = { x: body.x + body.w / 2, y: body.y + 0.3 }
  if (smokeDensityAt(world, head) < CHOKES_AT) return 0
  return toxicAt(world, head)
}
