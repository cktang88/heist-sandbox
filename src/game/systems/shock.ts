import { burst } from '../effects'
import { hurtGuard, stunGuard } from '../guards'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import type { Body } from '../types'
import type { World } from '../world'
import { circuitLive } from './circuits'
import { feetTile } from './footing'

/**
 * People standing in live water, or walking into a live cable, take a shock: it hurts, throws them, and drops a guard
 * for a few seconds. Each person is shocked at most once in a short while, so a puddle is a hazard, not a blender.
 */
const PLAYER_SHOCK = 18
const GUARD_SHOCK = 25
const GUARD_STUN = 3
const COOLDOWN = 0.8
const NOISE = 4
const ARC = '#cfe9ff'
const WIRE_REACH = 0.45

export function stepShocks(world: World): void {
  const systems = world.systems
  if (systems.energized.size === 0 && systems.wires.length === 0) return
  const player = world.player
  if (isLive(world, player)) shockPlayer(world)
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || !isLive(world, guard)) continue
    if (!ready(world, guard)) continue
    zap(world, guard, 'guard')
    stunGuard(guard, GUARD_STUN)
    hurtGuard(world, guard, GUARD_SHOCK, { x: guard.x + guard.w / 2, y: guard.y + guard.h }, 'hazard')
  }
}

/** Is this body's footing carrying current, or is it touching a live cable? */
export function isLive(world: World, body: Body): boolean {
  const feet = feetTile(body)
  if (world.systems.energized.has(feet.y * world.grid.width + feet.x)) return true
  for (const wire of world.systems.wires) {
    if (!circuitLive(world, wire.circuit)) continue
    if (wire.x > body.x - WIRE_REACH && wire.x < body.x + body.w + WIRE_REACH && body.y + body.h > wire.top && body.y < wire.y + 1) return true
  }
  return false
}

function ready(world: World, body: Body): boolean {
  if ((world.systems.shockedUntil.get(body) ?? 0) > world.clock) return false
  world.systems.shockedUntil.set(body, world.clock + COOLDOWN)
  return true
}

function shockPlayer(world: World): void {
  const player = world.player
  if (!ready(world, player)) return
  zap(world, player, 'player')
  player.hp -= PLAYER_SHOCK
  // A white jolt across the eyes, so the player sees what hit him.
  player.blindSeconds = Math.max(player.blindSeconds, 0.25)
}

function zap(world: World, body: Body, source: 'player' | 'guard'): void {
  const at = { x: body.x + body.w / 2, y: body.y + body.h * 0.6 }
  body.vy = Math.min(body.vy, -4)
  body.vx = -body.vx * 0.5
  burst(world.effects, world.systems.rng, at, 14, ARC, 8)
  playSound(world, 'spark', at)
  emitNoise(world, at, NOISE, source)
}
