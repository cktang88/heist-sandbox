import { hurtGuard, type Guard } from '../guards'
import type { NoiseSource } from '../security/hearing'
import { emitNoise } from '../noise'
import { GRAVITY, moveBody } from '../physics'
import { playSound } from '../sounds'
import { centerOf, distance, type Vec } from '../types'
import { hasLineOfSight } from '../vision'
import type { World } from '../world'
import { openAreaAround, topUpSmoke } from './smoke'
import type { Grenade, GrenadeKind } from './state'

const THROW_SPEED = 15
const LOFT = 3
const SIZE = 0.3
const FUSE: Record<GrenadeKind, number> = { smoke: 1.2, flash: 1.5 }
/** Bounces keep this share of the speed; rolling slows by this share per second. */
const BOUNCE = 0.35
const ROLL_FRICTION = 4
/**
 * A smoke grenade's cloud fills the nearest open tiles (about a 10-tile-wide room) over its first moments,
 * stays thick while the canister burns, then thins away on its own: about 20 s in all.
 */
const SMOKE_SECONDS = 9
const BLOOM_SECONDS = 1.5
const CLOUD_TILES = 50
const CLOUD_DENSITY = 1.2
const FLASH_REACH = 12
const FLASH_NOISE = 40
/** Blindness facing the flash at point-blank range, and facing away; deafness at point-blank range. */
const BLIND_FACING = 3.6
const BLIND_AWAY = 1.5
const DEAF = 4
/** The player gets a softer flash than the guards, so it never takes control away for long. */
const PLAYER_BLIND = 1.4
const PLAYER_DEAF = 2
const FLASH_DAMAGE = 3
const FLASH_DAMAGE_REACH = 1.5
const FLASH_FADE_SECONDS = 0.5

export function throwGrenade(world: World, kind: GrenadeKind, from: Vec, direction: Vec, thrower: NoiseSource = 'player'): void {
  const length = Math.hypot(direction.x, direction.y) || 1
  world.hazards.grenades.push({
    x: from.x - SIZE / 2, y: from.y - SIZE / 2, w: SIZE, h: SIZE,
    vx: (direction.x / length) * THROW_SPEED, vy: (direction.y / length) * THROW_SPEED - LOFT, onGround: false,
    kind, fuse: FUSE[kind], popped: false, smokeLeft: 0, cloud: [], thrower,
  })
}

export function stepGrenades(world: World, dt: number): void {
  const hazards = world.hazards
  if (hazards.grenades.length === 0) return
  for (const grenade of hazards.grenades) {
    fly(world, grenade, dt)
    if (grenade.popped) {
      pourSmoke(world, grenade, dt)
      continue
    }
    grenade.fuse -= dt
    if (grenade.fuse > 0) continue
    grenade.popped = true
    if (grenade.kind === 'flash') detonateFlash(world, centerOf(grenade), grenade.thrower)
    else {
      const at = centerOf(grenade)
      playSound(world, 'smokePop', at)
      grenade.smokeLeft = SMOKE_SECONDS
      grenade.cloud = openAreaAround(world, Math.floor(at.x), Math.floor(at.y), CLOUD_TILES)
    }
  }
  hazards.grenades = hazards.grenades.filter((grenade) => !grenade.popped || grenade.smokeLeft > 0)
}

/** Flies, bounces a little off whatever it hits, and rolls to rest. */
function fly(world: World, grenade: Grenade, dt: number): void {
  grenade.vy += GRAVITY * dt
  const before = { x: grenade.vx, y: grenade.vy }
  if (moveBody(world.grid, grenade, dt, 0)) grenade.vx = -before.x * BOUNCE
  if (grenade.vy === 0 && before.y !== 0) {
    grenade.vy = Math.abs(before.y) > 4 ? -before.y * BOUNCE : 0
    if (grenade.onGround) grenade.vx *= 0.75
  }
  if (grenade.onGround && grenade.vy === 0) {
    grenade.vx *= Math.max(0, 1 - ROLL_FRICTION * dt)
    if (Math.abs(grenade.vx) < 0.05) grenade.vx = 0
  }
}

function pourSmoke(world: World, grenade: Grenade, dt: number): void {
  const bloom = Math.min(1, (SMOKE_SECONDS - grenade.smokeLeft) / BLOOM_SECONDS)
  const reached = Math.ceil(grenade.cloud.length * bloom)
  for (let index = 0; index < reached; index += 1) topUpSmoke(world, grenade.cloud[index], CLOUD_DENSITY * bloom)
  grenade.smokeLeft -= dt
}

/**
 * A flashbang: everyone who can see the burst within reach is blinded and deafened, worst up close and for
 * guards looking at it. Walls stop it completely. It barely hurts, but everyone in earshot hears it.
 * A guard's flashbang is announced ("Flash out!") to colleagues in the fight, who turn their eyes away;
 * the player, whoever threw it, gets the full effect of any flash he can see.
 */
export function detonateFlash(world: World, at: Vec, thrower: NoiseSource = 'player'): void {
  world.hazards.flashes.push({ ...at, life: 1 })
  playSound(world, 'flashbang', at)
  emitNoise(world, at, FLASH_NOISE, thrower)
  world.shake = Math.min(1, world.shake + 0.3)
  for (const guard of world.guards) {
    if (guard.state === 'dead') continue
    const closeness = flashCloseness(world, eyeOf(guard), at)
    if (closeness <= 0) continue
    const warned = thrower === 'guard' && guard.mode === 'combat'
    const blind = facesPoint(guard, at) && !warned ? BLIND_FACING : BLIND_AWAY
    guard.blindSeconds = Math.max(guard.blindSeconds, blind * closeness)
    guard.deafSeconds = Math.max(guard.deafSeconds, DEAF * closeness)
    if (distance(centerOf(guard), at) <= FLASH_DAMAGE_REACH) hurtGuard(world, guard, FLASH_DAMAGE, at, 'hazard')
  }
  const player = world.player
  const closeness = flashCloseness(world, eyeOf(player), at)
  if (closeness <= 0) return
  player.blindSeconds = Math.max(player.blindSeconds, PLAYER_BLIND * closeness)
  player.deafSeconds = Math.max(player.deafSeconds, PLAYER_DEAF * closeness)
  if (distance(centerOf(player), at) <= FLASH_DAMAGE_REACH) player.hp -= FLASH_DAMAGE
}

function eyeOf(person: Guard | World['player']): Vec {
  return { x: person.x + person.w / 2, y: person.y + 0.3 }
}

/** 1 at point-blank range, falling to a quarter at the edge of reach; 0 out of reach or out of sight. */
function flashCloseness(world: World, eye: Vec, at: Vec): number {
  const gap = distance(eye, at)
  if (gap > FLASH_REACH || !hasLineOfSight(world.grid, eye, at)) return 0
  return 0.25 + 0.75 * (1 - gap / FLASH_REACH)
}

function facesPoint(guard: Guard, at: Vec): boolean {
  const dx = at.x - (guard.x + guard.w / 2)
  return Math.abs(dx) < 0.5 || Math.sign(dx) === guard.facing
}

export function stepFlashes(world: World, dt: number): void {
  const hazards = world.hazards
  if (hazards.flashes.length === 0) return
  for (const item of hazards.flashes) item.life -= dt / FLASH_FADE_SECONDS
  hazards.flashes = hazards.flashes.filter((item) => item.life > 0)
}
