import { hurtTile } from './destruction'
import { burst, flash } from './effects'
import { hurtGuard } from './guards'
import { emitNoise } from './noise'
import { triggerSlowmo } from './time'
import { centerOf, distance, type Body, type Vec } from './types'
import type { World } from './world'

export type Blast = { radius: number; tileDamage: number; bodyDamage: number }

export const ROCKET_BLAST: Blast = { radius: 3.4, tileDamage: 260, bodyDamage: 160 }
export const C4_BLAST: Blast = { radius: 4.6, tileDamage: 650, bodyDamage: 260 }
export const DRONE_BLAST: Blast = { radius: 2.6, tileDamage: 180, bodyDamage: 140 }

const PLAYER_DAMAGE_SHARE = 0.35
const KNOCK_SPEED = 16
const CHAIN_FUSE_SECONDS = 0.08

/** Blows a hole in the world: breaks tiles, hurts and throws bodies, sets off nearby charges. */
export function explode(world: World, at: Vec, blast: Blast): void {
  const reach = Math.ceil(blast.radius)
  for (let tileY = Math.floor(at.y) - reach; tileY <= Math.floor(at.y) + reach; tileY += 1) {
    for (let tileX = Math.floor(at.x) - reach; tileX <= Math.floor(at.x) + reach; tileX += 1) {
      const gap = Math.hypot(tileX + 0.5 - at.x, tileY + 0.5 - at.y)
      if (gap <= blast.radius) hurtTile(world, tileX, tileY, blast.tileDamage * (1 - (gap / blast.radius) * 0.75))
    }
  }

  let killed = 0
  for (const guard of world.guards) {
    if (guard.state === 'dead') continue
    const force = falloff(at, guard, blast.radius)
    if (force <= 0) continue
    knock(guard, at, force)
    if (hurtGuard(world, guard, blast.bodyDamage * force, at)) killed += 1
  }

  const playerForce = falloff(at, world.player, blast.radius)
  if (playerForce > 0) {
    world.player.hp -= blast.bodyDamage * playerForce * PLAYER_DAMAGE_SHARE
    knock(world.player, at, playerForce)
  }

  for (const charge of world.charges) {
    if (charge.fuse === null && distance(centerOf(charge), at) <= blast.radius) charge.fuse = CHAIN_FUSE_SECONDS
  }

  flash(world.effects, at, blast.radius, 0.35, 'explosion')
  burst(world.effects, world.rng, at, 26, '#ffb347', 14)
  burst(world.effects, world.rng, at, 14, '#55504a', 9)
  world.shake = Math.min(1.4, world.shake + blast.radius * 0.18)
  emitNoise(world, at, 45)
  if (killed > 0) triggerSlowmo(world.time, 0.45, 0.18)
}

function falloff(at: Vec, body: Body, radius: number): number {
  return Math.max(0, 1 - distance(centerOf(body), at) / (radius + 0.6))
}

function knock(body: Body, at: Vec, force: number): void {
  const center = centerOf(body)
  const gap = Math.max(0.2, distance(center, at))
  body.vx += ((center.x - at.x) / gap) * KNOCK_SPEED * force
  body.vy += ((center.y - at.y) / gap) * KNOCK_SPEED * force - 5 * force
}
