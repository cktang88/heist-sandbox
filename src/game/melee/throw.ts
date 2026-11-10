import type { PropState } from '../cover'
import { hurtGuard, type Guard } from '../guards'
import { propBox, propCenter } from '../hazards/props'
import { emitNoise } from '../noise'
import { boxHitsSolid, GRAVITY } from '../physics'
import { isThrowable, knocksDown, weightOf } from '../physprops/kinds'
import { propsAround } from '../physprops/nearby'
import { looseProps, loosen, rekeyIfMoved, shiftProp, type LooseProp } from '../physprops/state'
import { playSound } from '../sounds'
import { handOf } from '../tools'
import { centerOf, distance, type Rect, type Vec } from '../types'
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
/** Thrown things carry further than the game's brisk falling gravity would let them, so a throw can reach across a room. */
const FLIGHT_GRAVITY = GRAVITY * 0.5
/** Thrown things leave the hand with a little upward lift, so a throw at a man's chest still reaches him. */
const THROW_LIFT = 3
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
  const center = propCenter(prop)
  const shift = clearShift(world, propBox(prop), hand.x - center.x, hand.y - center.y)
  if (shift === null) return false
  if (world.physProps.grabbed?.id === prop.id) world.physProps.grabbed = null
  const loose = loosen(world, prop)
  shiftProp(prop, shift, hand.y - center.y)
  const direction = normalize(aim.x - hand.x, aim.y - hand.y)
  const share = Math.min(1, Math.max(HEAVY_SPEED_SHARE, LIGHT_SPEED_SHARE - weightOf(prop.kind) * SPEED_LOST_PER_WEIGHT))
  const speed = THROW_SPEED * share
  Object.assign(loose, { flying: true, tipped: 0, vx: direction.x * speed, vy: direction.y * speed - THROW_LIFT })
  world.melee.strike = { kind: 'throw', at: world.clock }
  return true
}

const NUDGE_STEP = 0.05

/**
 * The sideways move that brings a prop into the hand. Something wider than the player, picked up while he leans on
 * a wall, would stick into it there (and then hang in it); it is held a little off the wall instead. Null if it
 * cannot be held clear at all.
 */
function clearShift(world: World, box: Rect, dx: number, dy: number): number | null {
  for (let nudge = 0; nudge <= box.w / 2 + NUDGE_STEP; nudge += NUDGE_STEP) {
    for (const side of [-1, 1]) {
      const x = dx + side * nudge
      if (!boxHitsSolid(world.grid, { ...box, x: box.x + x, y: box.y + dy })) return x
    }
  }
  return null
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
  loose.vy += FLIGHT_GRAVITY * dt
  const steps = Math.max(1, Math.ceil((Math.hypot(loose.vx, loose.vy) * dt) / FLIGHT_STEP))
  for (let step = 0; step < steps; step += 1) {
    const dx = (loose.vx * dt) / steps
    const dy = (loose.vy * dt) / steps
    const box = propBox(prop)
    const moved = { ...box, x: box.x + dx, y: box.y + dy }
    if (boxHitsSolid(world.grid, moved)) {
      if (!smashGlassIn(world, moved)) return land(world, prop, loose, propCenter(prop))
      loose.vx *= GLASS_SLOWDOWN
      loose.vy *= GLASS_SLOWDOWN
    }
    const center = propCenter(prop)
    const next = { x: center.x + dx, y: center.y + dy }
    const guard = guardAt(world, next)
    if (guard) {
      hitGuard(world, guard, prop, loose)
      return land(world, prop, loose, next)
    }
    shiftProp(prop, dx, dy)
  }
  rekeyIfMoved(world, prop, loose, false)
}

/** Breaks every pane the box overlaps. Returns true if it went through glass and nothing else. */
function smashGlassIn(world: World, box: Rect): boolean {
  let smashed = false
  for (let y = Math.floor(box.y); y <= Math.floor(box.y + box.h - 0.001); y += 1) {
    for (let x = Math.floor(box.x); x <= Math.floor(box.x + box.w - 0.001); x += 1) if (smashGlass(world, x, y)) smashed = true
  }
  return smashed && !boxHitsSolid(world.grid, box)
}

/** The flight ends: it clatters here and drops; gravity takes it from there. */
function land(world: World, prop: PropState, loose: LooseProp, at: Vec): void {
  Object.assign(loose, { flying: false, vx: 0, vy: 0 })
  playSound(world, 'impact', at)
  emitNoise(world, at, CLATTER_NOISE + weightOf(prop.kind) * CLATTER_NOISE_PER_WEIGHT)
}

/** A man on his feet in the way. Bodies lie low (or sit in a locker) and are flown over. */
function guardAt(world: World, at: Vec): Guard | null {
  return world.guards.find((guard) => guard.mode !== 'dead' && !guard.out && guard !== world.melee.shield
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
