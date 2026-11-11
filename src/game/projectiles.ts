import { shootDeviceAt } from './ballistics/devices'
import { shootLampsAt } from './ballistics/lamps'
import { BODY_RESISTANCE, DEVICE_RESISTANCE, pierce, propResistance, tileResistance } from './ballistics/materials'
import { strikeTile } from './ballistics/impacts'
import { coverPropAt, shootLoosePropsAt, stillInside } from './ballistics/props'
import { shotHitsProp, type PropState } from './cover'
import { burst, flash } from './effects'
import { explode, ROCKET_BLAST } from './explosions'
import { hurtGuard, shieldBlocks, type Guard } from './guards'
import { blocksLaneAt, inBounds, tileAt, TILE_DEFS } from './tiles'
import { hitPause, triggerSlowmo } from './time'
import { centerOf, distance, type Rect, type Vec } from './types'
import type { World } from './world'

export type Projectile = Vec & {
  /** Player-selected impact area. Omitted for ordinary guard fire and simulation shots. */
  aimPoint?: Vec
  vx: number
  vy: number
  kind: 'bullet' | 'rocket'
  fromPlayer: boolean
  damage: number
  tileDamage: number
  push: number
  life: number
  /** Penetration left: what the round can still punch through (see ballistics/materials.ts). */
  power: number
  /** Grid index of the solid tile the round is passing through right now, or -1. */
  inTile: number
  /** The cover prop the round is passing through right now. */
  inProp: PropState | null
  /** People, props and devices this round has already hit, so it hurts each only once on its way through. */
  struck: Set<object> | null
}

export type ShotSpec = {
  aimPoint?: Vec
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
  /** How much a round can punch through before it stops; 0 (the default) stops at the first solid thing. */
  penetration?: number
}

const MAX_STEP = 0.3
const NEAR_MISS_DISTANCE = 1.3

export function fireShot(world: World, from: Vec, direction: Vec, spec: ShotSpec): void {
  const angle = Math.atan2(direction.y, direction.x) + (world.rng() - 0.5) * 2 * spec.spread
  world.projectiles.push({
    x: from.x, y: from.y, vx: Math.cos(angle) * spec.speed, vy: Math.sin(angle) * spec.speed,
    kind: spec.kind, fromPlayer: spec.fromPlayer, damage: spec.damage, tileDamage: spec.tileDamage, push: spec.push, life: spec.life ?? 3,
    power: spec.penetration ?? 0, inTile: startingTile(world, from), inProp: null, struck: null,
    aimPoint: spec.fromPlayer && spec.aimPoint ? { ...spec.aimPoint } : undefined,
  })
  flash(world.effects, from, 0.5, 0.07, 'muzzle', angle)
}

/**
 * A gun can be inside a solid tile (a body crossing a slab on the stairs overlaps it). The round treats that tile
 * as one it is already passing through, so it is neither stopped nor set off by it.
 */
function startingTile(world: World, from: Vec): number {
  const x = Math.floor(from.x)
  const y = Math.floor(from.y)
  return inBounds(world.grid, x, y) && TILE_DEFS[tileAt(world.grid, x, y)].stopsShots ? y * world.grid.width + x : -1
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
    if (projectile.kind === 'rocket' && projectile.aimPoint && reachedAim(projectile)) {
      explode(world, projectile.aimPoint, ROCKET_BLAST)
      return true
    }
    if (projectile.kind === 'rocket' ? rocketHits(world, projectile) : bulletStops(world, projectile)) {
      if (projectile.kind === 'rocket') explode(world, projectile, ROCKET_BLAST)
      return true
    }
  }
  if (projectile.kind === 'rocket') burst(world.effects, world.rng, projectile, 1, '#8a8f98', 1.5)
  projectile.life -= dt
  return projectile.life <= 0
}

/** Along-flight distance avoids missing a cursor point between two simulation steps. */
function reachedAim(shot: Projectile, before = 0): boolean {
  if (!shot.aimPoint) return true
  const speed = Math.hypot(shot.vx, shot.vy)
  return (shot.aimPoint.x - shot.x) * shot.vx + (shot.aimPoint.y - shot.y) * shot.vy <= before * speed
}

/** Furniture and wall fixtures in another part of the room must not steal a cursor-directed shot. */
function inAimArea(shot: Projectile): boolean {
  return !shot.aimPoint || reachedAim(shot, 0.8)
}

function tileCanStop(world: World, shot: Projectile, x: number, y: number): boolean {
  if (!TILE_DEFS[tileAt(world.grid, x, y)].stopsShots) return false
  if (!shot.aimPoint || blocksLaneAt(world.grid, x, y)) return true
  return Math.floor(shot.aimPoint.x) === x && Math.floor(shot.aimPoint.y) === y
}

/** A rocket goes off against the first thing it touches. */
function rocketHits(world: World, rocket: Projectile): boolean {
  const tileX = Math.floor(rocket.x)
  const tileY = Math.floor(rocket.y)
  if (rocket.inTile >= 0 && rocket.inTile !== tileY * world.grid.width + tileX) rocket.inTile = -1
  if (rocket.inTile < 0 && tileCanStop(world, rocket, tileX, tileY)) return true
  if (inAimArea(rocket) && shotHitsProp(world, rocket, rocket.damage)) return true
  return rocket.fromPlayer ? guardHit(world, rocket) !== null : contains(world.player, rocket)
}

/**
 * Everything a bullet meets at one point of its flight, in the order it would meet them. Lamps smash and loose
 * reactive props take damage without slowing it; tiles, devices, cover and people each cost it penetration
 * power, and it stops at the first one it cannot get through. Returns true when it stops.
 */
function bulletStops(world: World, bullet: Projectile): boolean {
  const aimed = inAimArea(bullet)
  if (aimed) shootLampsAt(world, bullet)
  if (aimed && shootDeviceAt(world, bullet) && !pierce(bullet, DEVICE_RESISTANCE)) return true
  if (tileStops(world, bullet)) return true
  if (bullet.inTile >= 0) return false
  if (aimed && coverStops(world, bullet)) return true
  if (aimed) shootLoosePropsAt(world, bullet, bullet.damage, bullet.fromPlayer, struckBy(bullet))
  return peopleStop(world, bullet)
}

function tileStops(world: World, bullet: Projectile): boolean {
  const tileX = Math.floor(bullet.x)
  const tileY = Math.floor(bullet.y)
  const kind = tileAt(world.grid, tileX, tileY)
  if (!tileCanStop(world, bullet, tileX, tileY)) {
    bullet.inTile = -1
    return false
  }
  const index = tileY * world.grid.width + tileX
  if (index === bullet.inTile) return false
  const tileDamage = bullet.tileDamage
  const through = pierce(bullet, tileResistance(kind))
  strikeTile(world, bullet, tileX, tileY, kind, tileDamage, through)
  if (!through) return true
  bullet.inTile = index
  return false
}

/** Cover props are cover.ts's to judge and damage; this only decides whether the round goes on out the far side. */
function coverStops(world: World, bullet: Projectile): boolean {
  if (bullet.inProp && stillInside(bullet.inProp, bullet)) return false
  bullet.inProp = null
  if (!shotHitsProp(world, bullet, bullet.damage)) return false
  const prop = coverPropAt(world, bullet)
  if (!prop || !pierce(bullet, propResistance(prop.kind))) return true
  bullet.inProp = prop
  return false
}

/** Player shots hit guards, guards' shots hit the player. Someone the round already went through does not count. */
function peopleStop(world: World, bullet: Projectile): boolean {
  if (!bullet.fromPlayer) return playerStops(world, bullet)
  const guard = guardHit(world, bullet)
  if (!guard) return false
  if (shieldBlocks(world, guard, bullet)) return true
  struckBy(bullet).add(guard)
  const speed = Math.hypot(bullet.vx, bullet.vy)
  guard.vx += (bullet.vx / speed) * bullet.push
  if (hurtGuard(world, guard, bullet.damage, centerOf(world.player))) hitPause(world.time, 0.06)
  return !pierce(bullet, BODY_RESISTANCE)
}

function playerStops(world: World, bullet: Projectile): boolean {
  const { player } = world
  if (bullet.struck?.has(player)) return false
  if (!contains(player, bullet)) {
    if (distance(centerOf(player), bullet) < NEAR_MISS_DISTANCE) triggerSlowmo(world.time, 0.4, 0.3)
    return false
  }
  struckBy(bullet).add(player)
  player.hp -= bullet.damage
  burst(world.effects, world.rng, bullet, 5, '#b3202a', 5)
  return !pierce(bullet, BODY_RESISTANCE)
}

function guardHit(world: World, shot: Projectile): Guard | null {
  for (const guard of world.guards) if (guard.state !== 'dead' && contains(guard, shot) && !shot.struck?.has(guard)) return guard
  return null
}

function struckBy(bullet: Projectile): Set<object> {
  bullet.struck ??= new Set()
  return bullet.struck
}

function contains(box: Rect, point: Vec): boolean {
  return point.x >= box.x - 0.1 && point.x <= box.x + box.w + 0.1 && point.y >= box.y - 0.1 && point.y <= box.y + box.h + 0.1
}
