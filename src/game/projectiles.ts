import { shotHitsProp } from './cover'
import { hurtTile } from './destruction'
import { burst, flash } from './effects'
import { explode, ROCKET_BLAST } from './explosions'
import { hurtGuard } from './guards'
import { stopsShotsAt } from './tiles'
import { hitPause, triggerSlowmo } from './time'
import { centerOf, distance, type Rect, type Vec } from './types'
import type { World } from './world'

export type Projectile = Vec & {
  vx: number
  vy: number
  kind: 'bullet' | 'rocket'
  fromPlayer: boolean
  damage: number
  tileDamage: number
  push: number
  life: number
}

export type ShotSpec = {
  kind: Projectile['kind']
  fromPlayer: boolean
  speed: number
  damage: number
  tileDamage: number
  spread: number
  /** How hard a hit shoves its target. */
  push: number
  /** Seconds before the shot fizzles out. Short for shotgun pellets. */
  life?: number
}

const MAX_STEP = 0.3
const NEAR_MISS_DISTANCE = 1.3

export function fireShot(world: World, from: Vec, direction: Vec, spec: ShotSpec): void {
  const angle = Math.atan2(direction.y, direction.x) + (world.rng() - 0.5) * 2 * spec.spread
  world.projectiles.push({
    x: from.x, y: from.y, vx: Math.cos(angle) * spec.speed, vy: Math.sin(angle) * spec.speed,
    kind: spec.kind, fromPlayer: spec.fromPlayer, damage: spec.damage, tileDamage: spec.tileDamage, push: spec.push, life: spec.life ?? 3,
  })
  flash(world.effects, from, 0.5, 0.07, 'muzzle', angle)
}

export function stepProjectiles(world: World, dt: number): void {
  world.projectiles = world.projectiles.filter((projectile) => !flyProjectile(world, projectile, dt))
}

/** Moves one shot in small steps so it cannot skip through a wall. Returns true when it is spent. */
function flyProjectile(world: World, projectile: Projectile, dt: number): boolean {
  const speed = Math.hypot(projectile.vx, projectile.vy)
  const steps = Math.max(1, Math.ceil((speed * dt) / MAX_STEP))
  for (let index = 0; index < steps; index += 1) {
    projectile.x += (projectile.vx * dt) / steps
    projectile.y += (projectile.vy * dt) / steps
    if (hitSomething(world, projectile)) {
      if (projectile.kind === 'rocket') explode(world, projectile, ROCKET_BLAST)
      return true
    }
  }
  if (projectile.kind === 'rocket') burst(world.effects, world.rng, projectile, 1, '#8a8f98', 1.5)
  projectile.life -= dt
  return projectile.life <= 0
}

function hitSomething(world: World, projectile: Projectile): boolean {
  if (stopsShotsAt(world.grid, projectile.x, projectile.y)) {
    if (projectile.kind === 'bullet') {
      hurtTile(world, Math.floor(projectile.x), Math.floor(projectile.y), projectile.tileDamage)
      burst(world.effects, world.rng, projectile, 2, '#d8d2c4', 4)
    }
    return true
  }

  if (shotHitsProp(world, projectile, projectile.damage)) return true

  if (!projectile.fromPlayer) {
    if (contains(world.player, projectile)) {
      world.player.hp -= projectile.damage
      burst(world.effects, world.rng, projectile, 5, '#b3202a', 5)
      return true
    }
    if (distance(centerOf(world.player), projectile) < NEAR_MISS_DISTANCE) triggerSlowmo(world.time, 0.4, 0.3)
    return false
  }

  const guard = world.guards.find((other) => other.state !== 'dead' && contains(other, projectile))
  if (!guard) return false
  if (projectile.kind === 'bullet') {
    const speed = Math.hypot(projectile.vx, projectile.vy)
    guard.vx += (projectile.vx / speed) * projectile.push
    if (hurtGuard(world, guard, projectile.damage, centerOf(world.player))) hitPause(world.time, 0.06)
  }
  return true
}

function contains(box: Rect, point: Vec): boolean {
  return point.x >= box.x - 0.1 && point.x <= box.x + box.w + 0.1 && point.y >= box.y - 0.1 && point.y <= box.y + box.h + 0.1
}
