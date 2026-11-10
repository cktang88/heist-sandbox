import { burst } from '../effects'
import { hurtGuard, stunGuard } from '../guards'
import { emitNoise } from '../noise'
import { playSound } from '../sounds'
import type { Body, Vec } from '../types'
import type { World } from '../world'
import { circuitLive, isEnergized } from './circuits'
import { feetTile } from './footing'

/**
 * People standing in live water, or walking into a live cable, take a shock: it hurts, throws them, and drops a guard
 * for a few seconds. Each person is shocked at most once in a short while, so a puddle is a hazard, not a blender.
 */
const PLAYER_SHOCK = 18
const GUARD_SHOCK = 25
const GUARD_STUN = 3
/** The jolt locks his muscles for a moment. */
const PLAYER_SHOCK_STUN = 0.5
const COOLDOWN = 0.8
const NOISE = 4
const ARC = '#cfe9ff'
const WIRE_REACH = 0.45

export function stepShocks(world: World): void {
  const systems = world.systems
  if (systems.energized.size === 0 && !systems.wires.some((wire) => circuitLive(world, wire.circuit))) return
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
  if (isEnergized(world, feet.y * world.grid.width + feet.x)) return true
  return touchesLiveWire(world, body.x - WIRE_REACH, body.x + body.w + WIRE_REACH, body.y, body.y + body.h)
}

/** Would someone standing at this spot (a point in the tile they stand in) be shocked? */
export function isLiveSpot(world: World, at: Vec): boolean {
  if (isEnergized(world, Math.floor(at.y) * world.grid.width + Math.floor(at.x))) return true
  return touchesLiveWire(world, at.x - 0.35 - WIRE_REACH, at.x + 0.35 + WIRE_REACH, at.y - 1.5, at.y + 0.5)
}

function touchesLiveWire(world: World, left: number, right: number, top: number, bottom: number): boolean {
  for (const wire of world.systems.wires) {
    if (circuitLive(world, wire.circuit) && wire.x > left && wire.x < right && bottom > wire.top && top < wire.y + 1) return true
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
  player.stunSeconds = Math.max(player.stunSeconds, PLAYER_SHOCK_STUN)
}

function zap(world: World, body: Body, source: 'player' | 'guard'): void {
  const at = { x: body.x + body.w / 2, y: body.y + body.h * 0.6 }
  body.vy = Math.min(body.vy, -4)
  body.vx = -body.vx * 0.5
  burst(world.effects, world.systems.rng, at, 14, ARC, 8)
  playSound(world, 'spark', at)
  emitNoise(world, at, NOISE, source)
}
