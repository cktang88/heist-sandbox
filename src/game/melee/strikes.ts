import type { PropState } from '../cover'
import { hurtGuard, type Guard } from '../guards'
import { propBox } from '../hazards/props'
import { openDoor } from '../interact'
import { emitNoise } from '../noise'
import { isPushable, isThrowable } from '../physprops/kinds'
import { propsAround } from '../physprops/nearby'
import { kickProp } from '../physprops/tip'
import { playSound } from '../sounds'
import { tileAt } from '../tiles'
import { centerOf, type Vec } from '../types'
import type { World } from '../world'
import { knockOutCold } from '../stealth/bodies'
import { TAKEDOWN } from '../stealth/tuning'
import { knockGuard, smashGlass } from './knock'
import { releaseShield } from './shield'
import type { Daze } from './state'

/**
 * Punches and kicks, thrown the way the player faces.
 * A punch is short and quick: it staggers a guard, and a quick run of them knocks him out; two for a man who did not
 * see it coming (slower than the silent takedown from behind), three for one who did.
 * A kick shoves a guard back hard enough to send him off a ledge or through glass, bursts a door open into whoever
 * stands behind it, tips tables and sends loose things skidding.
 */

const PUNCH_REACH = 1
const KICK_REACH = 1.3
const PUNCH_COOLDOWN = 0.35
const KICK_COOLDOWN = 0.6
const PUNCH_DAMAGE = 5
const KICK_DAMAGE = 6
const STAGGER_SECONDS = 0.9
const STAGGER_SHOVE = 2
export const KNOCKOUT_SECONDS = TAKEDOWN.punchOutSeconds
/** A run of punches must keep coming this often or it starts over. */
const DAZE_FORGET = 2
const PUNCHES_TO_DROP_UNAWARE = 2
const PUNCHES_TO_DROP_AWARE = 3
const KICK_SPEED = 11
const KICK_LIFT = 3
const KICK_STUN = 1.2
const PUNCH_NOISE = 3
const KICK_NOISE = 5
const DOOR_BURST_NOISE = 14
/** People this far beyond a kicked door are hit by it. */
const DOOR_SWING = 2.5
const DOOR_HIT_DAMAGE = 8
const DOOR_HIT_SPEED = 8
const DOOR_HIT_STUN = 1.5
const SAME_FLOOR = 0.8
/** How far beyond the foot a prop can be and still be kicked. */
const PROP_KICK_REACH = 0.6

export function punch(world: World): void {
  if (!startStrike(world, 'punch', PUNCH_COOLDOWN)) return
  const center = centerOf(world.player)
  emitNoise(world, center, PUNCH_NOISE)
  const shield = world.melee.shield
  if (shield) {
    releaseShield(world, false)
    knockOut(world, shield)
    return
  }
  const guard = guardInReach(world, PUNCH_REACH)
  if (!guard) return
  playSound(world, 'impact', centerOf(guard))
  const daze = dazeOf(world, guard)
  daze.hits += 1
  if (hurtGuard(world, guard, PUNCH_DAMAGE, center)) return
  if (daze.hits >= daze.need) {
    world.melee.dazes.delete(guard)
    knockOut(world, guard)
  } else knockGuard(world, guard, world.player.facing * STAGGER_SHOVE, 0, STAGGER_SECONDS)
}

export function kick(world: World): void {
  if (!startStrike(world, 'kick', KICK_COOLDOWN)) return
  const player = world.player
  const center = centerOf(player)
  emitNoise(world, center, KICK_NOISE)
  const target = world.melee.shield ?? guardInReach(world, KICK_REACH)
  if (target) {
    if (target === world.melee.shield) releaseShield(world, false)
    playSound(world, 'impact', centerOf(target))
    if (!hurtGuard(world, target, KICK_DAMAGE, center)) knockGuard(world, target, player.facing * KICK_SPEED, -KICK_LIFT, KICK_STUN)
    return
  }
  const door = doorAhead(world)
  if (door) return burstDoor(world, door)
  const foot = { x: center.x + player.facing * (player.w / 2 + 0.4), y: player.y + player.h - 0.5 }
  if (smashGlass(world, Math.floor(foot.x), Math.floor(foot.y)) || smashGlass(world, Math.floor(foot.x), Math.floor(foot.y - 1))) return
  const prop = propInReach(world)
  if (prop) kickProp(world, prop, player.facing)
}

/** Knocked cold for a couple of minutes. He drops limp where he stands, a body to hide like any other. */
export function knockOut(world: World, guard: Guard): void {
  knockOutCold(world, guard, KNOCKOUT_SECONDS)
}

function startStrike(world: World, kind: 'punch' | 'kick', cooldown: number): boolean {
  const melee = world.melee
  if (melee.cooldown > 0) return false
  melee.cooldown = cooldown
  melee.strike = { kind, at: world.clock }
  return true
}

function dazeOf(world: World, guard: Guard): Daze {
  const found = world.melee.dazes.get(guard)
  const daze = found && found.until > world.clock ? found : { hits: 0, need: guard.state === 'alert' ? PUNCHES_TO_DROP_AWARE : PUNCHES_TO_DROP_UNAWARE, until: 0 }
  daze.until = world.clock + DAZE_FORGET
  world.melee.dazes.set(guard, daze)
  return daze
}

/** The nearest standing guard in front of the player, on his floor, within reach of a fist or foot. */
function guardInReach(world: World, reach: number): Guard | null {
  const player = world.player
  const center = centerOf(player)
  let best: Guard | null = null
  let bestGap = Infinity
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || guard.out) continue
    const gap = (centerOf(guard).x - center.x) * player.facing
    const sameFloor = Math.abs(guard.y + guard.h - (player.y + player.h)) < SAME_FLOOR
    if (!sameFloor || gap < -0.2 || gap > reach + guard.w / 2 || gap >= bestGap) continue
    best = guard
    bestGap = gap
  }
  return best
}

function doorAhead(world: World): Vec | null {
  const player = world.player
  const feet = player.y + player.h
  const column = Math.floor(player.x + player.w / 2 + player.facing * 0.9)
  for (const up of [1, 2, 3]) {
    const row = Math.floor(feet - up)
    if (tileAt(world.grid, column, row) === 'door') return { x: column, y: row }
  }
  return null
}

/** The door flies open, hitting whoever is just behind it. */
function burstDoor(world: World, door: Vec): void {
  const facing = world.player.facing
  const feet = world.player.y + world.player.h
  openDoor(world.grid, door)
  world.structureChanged = true
  const at = { x: door.x + 0.5, y: door.y + 0.5 }
  playSound(world, 'door', at)
  emitNoise(world, at, DOOR_BURST_NOISE)
  for (const guard of world.guards) {
    if (guard.mode === 'dead' || Math.abs(guard.y + guard.h - feet) > SAME_FLOOR) continue
    const beyond = (centerOf(guard).x - at.x) * facing
    if (beyond <= 0 || beyond > DOOR_SWING) continue
    if (!hurtGuard(world, guard, DOOR_HIT_DAMAGE, centerOf(world.player))) knockGuard(world, guard, facing * DOOR_HIT_SPEED, -2, DOOR_HIT_STUN)
  }
}

/** The nearest movable floor prop just in front of the player's foot, on his floor. */
function propInReach(world: World): PropState | null {
  const player = world.player
  const feet = player.y + player.h
  const front = player.facing > 0 ? player.x + player.w : player.x
  let best: PropState | null = null
  let bestGap = PROP_KICK_REACH
  for (const prop of propsAround(world, centerOf(player), 4)) {
    if (!isPushable(prop.kind) && !isThrowable(prop.kind)) continue
    const box = propBox(prop)
    if (Math.abs(box.y + box.h - feet) > SAME_FLOOR / 2) continue
    const near = player.facing > 0 ? box.x - front : front - (box.x + box.w)
    const far = player.facing > 0 ? box.x + box.w - front : front - box.x
    if (far <= 0) continue
    const gap = Math.max(0, near)
    if (gap > bestGap) continue
    best = prop
    bestGap = gap
  }
  return best
}
