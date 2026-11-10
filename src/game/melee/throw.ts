import type { PropState } from '../cover'
import { hurtGuard, type Guard } from '../guards'
import { propCenter } from '../hazards/props'
import { emitNoise } from '../noise'
import { GRAVITY } from '../physics'
import { isThrowable, knocksDown, weightOf } from '../physprops/kinds'
import { propsAround } from '../physprops/nearby'
import { looseProps, loosen, rekeyIfMoved, shiftProp, type LooseProp } from '../physprops/state'
import { playSound } from '../sounds'
import { isSolidAt } from '../tiles'
import { handOf } from '../tools'
import { centerOf, distance, type Vec } from '../types'
import { normalize } from '../vision'
import type { World } from '../world'
import { knockGuard, smashGlass } from './knock'

/**
 * Throw picks up the nearest small loose thing (a bin, a chair, a stool, an extinguisher off the wall) and hurls
 * it along the aim. Wherever it hits it clatters, which guards come to investigate like any other noise.
 * A guard it hits flinches and cannot fire for a moment; something heavy knocks him off his feet.
 */

const THROW_REACH = 1.8
const THROW_SPEED = 18
/** Heavier things leave the hand slower: full speed for light things, down to a floor for the heaviest. */
const LIGHT_SPEED_SHARE = 1.15
const SPEED_LOST_PER_WEIGHT = 0.3
const HEAVY_SPEED_SHARE = 0.6
const FLIGHT_STEP = 0.25
const CLATTER_NOISE = 9
const CLATTER_NOISE_PER_WEIGHT = 3
const HIT_DAMAGE = 4
const HIT_DAMAGE_PER_WEIGHT = 6
const FLINCH_SECONDS = 1.2
const KNOCKDOWN_SPEED_SHARE = 0.4
const KNOCKDOWN_STUN = 1.6
/** Glass a thrown thing goes through slows it this much. */
const GLASS_SLOWDOWN = 0.6

/** Throws the nearest small prop toward `aim`. Returns true if something was thrown. */
export function throwNearest(world: World, aim: Vec): boolean {
  if (world.melee.shield) return false
  const hand = handOf(world)
  const prop = throwableInReach(world, hand)
  if (!prop) return false
  if (world.physProps.grabbed?.id === prop.id) world.physProps.grabbed = null
  const loose = loosen(world, prop)
  const center = propCenter(prop)
  shiftProp(prop, hand.x - center.x, hand.y - center.y)
  const direction = normalize(aim.x - hand.x, aim.y - hand.y)
  const share = Math.min(1, Math.max(HEAVY_SPEED_SHARE, LIGHT_SPEED_SHARE - weightOf(prop.kind) * SPEED_LOST_PER_WEIGHT))
  const speed = THROW_SPEED * share
  Object.assign(loose, { flying: true, tipped: 0, vx: direction.x * speed, vy: direction.y * speed })
  return true
}

function throwableInReach(world: World, hand: Vec): PropState | null {
  let best: PropState | null = null
  let bestGap = THROW_REACH
  for (const prop of propsAround(world, hand, THROW_REACH + 1)) {
    if (!isThrowable(prop.kind) || world.physProps.loose.get(prop.id)?.flying) continue
    const gap = distance(propCenter(prop), hand)
    if (gap >= bestGap) continue
    best = prop
    bestGap = gap
  }
  return best
}

export function stepFlights(world: World, dt: number): void {
  for (const { prop, loose } of looseProps(world)) if (loose.flying) fly(world, prop, loose, dt)
}

function fly(world: World, prop: PropState, loose: LooseProp, dt: number): void {
  loose.vy += GRAVITY * dt
  const steps = Math.max(1, Math.ceil((Math.hypot(loose.vx, loose.vy) * dt) / FLIGHT_STEP))
  for (let step = 0; step < steps; step += 1) {
    const center = propCenter(prop)
    const next = { x: center.x + (loose.vx * dt) / steps, y: center.y + (loose.vy * dt) / steps }
    if (isSolidAt(world.grid, next.x, next.y)) {
      if (!smashGlass(world, Math.floor(next.x), Math.floor(next.y))) return land(world, prop, loose, center)
      loose.vx *= GLASS_SLOWDOWN
      loose.vy *= GLASS_SLOWDOWN
    }
    const guard = guardAt(world, next)
    if (guard) {
      hitGuard(world, guard, prop, loose)
      return land(world, prop, loose, next)
    }
    shiftProp(prop, next.x - center.x, next.y - center.y)
  }
  rekeyIfMoved(world, prop, loose, false)
}

/** The flight ends: it clatters here and drops; gravity takes it from there. */
function land(world: World, prop: PropState, loose: LooseProp, at: Vec): void {
  Object.assign(loose, { flying: false, vx: 0, vy: 0 })
  playSound(world, 'impact', at)
  emitNoise(world, at, CLATTER_NOISE + weightOf(prop.kind) * CLATTER_NOISE_PER_WEIGHT)
}

function guardAt(world: World, at: Vec): Guard | null {
  return world.guards.find((guard) => guard.mode !== 'dead' && guard !== world.melee.shield
    && at.x >= guard.x && at.x <= guard.x + guard.w && at.y >= guard.y && at.y <= guard.y + guard.h) ?? null
}

function hitGuard(world: World, guard: Guard, prop: PropState, loose: LooseProp): void {
  const weight = weightOf(prop.kind)
  guard.hitFlash = 0.15
  guard.kick = 1
  guard.shootCooldown = Math.max(guard.shootCooldown, FLINCH_SECONDS)
  if (hurtGuard(world, guard, HIT_DAMAGE + weight * HIT_DAMAGE_PER_WEIGHT, centerOf(world.player))) return
  if (knocksDown(prop.kind)) knockGuard(world, guard, loose.vx * KNOCKDOWN_SPEED_SHARE, -2, KNOCKDOWN_STUN)
}
