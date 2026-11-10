import { stunGuard, type Guard } from '../guards'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import type { Body } from '../types'
import type { World } from '../world'
import { anythingUnderfoot, DEEP_DEPTH, feetTile, footingOf, slipRate, WADING_DEPTH } from './footing'
import { liquidAt } from './liquid'

/**
 * What wet floors and standing water do to people: running on a wet or fuel-slick floor can put you on your back,
 * wading slows you and every step splashes loudly, and under water the world goes quiet.
 */
const PLAYER_RUNNING = 6.5
const GUARD_RUNNING = 4.5
const SLIP_COOLDOWN = 2.5
const SLIP_DAMAGE = 4
const GUARD_SLIP_STUN = 1.6
const SLIP_NOISE = 7
/** Per second, the share of speed water takes off. */
const WADE_DRAG = 5
const DEEP_DRAG = 9
const SPLASH_EVERY = 0.35
const SPLASH_NOISE = 6
const CROUCHED_SPLASH_NOISE = 3

export function stepWading(world: World, dt: number): void {
  if (!anythingUnderfoot(world)) return
  stepPlayer(world, dt)
  for (const guard of world.guards) if (guard.mode !== 'dead') stepGuard(world, guard, dt)
}

function depthUnder(world: World, body: Body): number {
  const feet = feetTile(body)
  return liquidAt(world, 'water', feet.x, feet.y)
}

function drag(body: Body, depth: number, dt: number): void {
  if (depth < WADING_DEPTH) return
  body.vx *= Math.exp(-(depth >= DEEP_DEPTH ? DEEP_DRAG : WADE_DRAG) * dt)
}

/** Rolls for a slip. Shared rule for the player and guards: running on a slippery floor, at most once in a while. */
export function rollSlip(world: World, body: Body, running: boolean, dt: number): boolean {
  if (!running || !body.onGround) return false
  const rate = slipRate(footingOf(world, body))
  if (rate === 0 || (world.systems.slipUntil.get(body) ?? 0) > world.clock) return false
  if (world.systems.rng() >= rate * dt) return false
  world.systems.slipUntil.set(body, world.clock + SLIP_COOLDOWN)
  return true
}

function stepPlayer(world: World, dt: number): void {
  const player = world.player
  const depth = depthUnder(world, player)
  drag(player, depth, dt)
  if (rollSlip(world, player, Math.abs(player.vx) > PLAYER_RUNNING && !player.crouching, dt)) {
    // Feet go out: he skids along on his back, which is what a slide already looks like.
    player.slide = 0.7
    player.crouching = true
    player.vx *= 1.3
    player.hp -= SLIP_DAMAGE
    fall(world, player, 'player')
  }
  splash(world, player, depth, player.crouching ? CROUCHED_SPLASH_NOISE : SPLASH_NOISE, 'player')
  // Under water: muffled hearing.
  if (depth >= player.h * 0.8) player.deafSeconds = Math.max(player.deafSeconds, 0.3)
}

function stepGuard(world: World, guard: Guard, dt: number): void {
  const depth = depthUnder(world, guard)
  drag(guard, depth, dt)
  if (guard.stunSeconds > 0) return
  if (rollSlip(world, guard, Math.abs(guard.vx) > GUARD_RUNNING, dt)) {
    stunGuard(guard, GUARD_SLIP_STUN)
    fall(world, guard, 'guard')
  }
  splash(world, guard, depth, SPLASH_NOISE, 'guard')
}

function fall(world: World, body: Body, source: 'player' | 'guard'): void {
  const at = { x: body.x + body.w / 2, y: body.y + body.h }
  body.vy = Math.min(body.vy, -3)
  playSound(world, 'impact', at)
  emitNoise(world, at, SLIP_NOISE, source)
}

/** Feet in water make a splash every stride, loud enough to give a sneak away. Swimming is quieter. */
function splash(world: World, body: Body, depth: number, radius: number, source: 'player' | 'guard'): void {
  if (depth < 0.03 || Math.abs(body.vx) < 1.5 || !body.onGround) return
  const next = world.systems.stepClock.get(body) ?? 0
  if (next > world.clock) return
  world.systems.stepClock.set(body, world.clock + SPLASH_EVERY)
  const at = { x: body.x + body.w / 2, y: body.y + body.h }
  playSound(world, 'footstep', at)
  emitNoise(world, at, depth >= DEEP_DEPTH ? radius / 2 : radius, source)
}
