import type { Guard } from '../guards'
import { capPlayerSpeed } from '../physprops/pace'
import { boxHitsSolid } from '../physics'
import { createRagdoll } from '../ragdoll'
import { TOOLS, toolIndex } from '../toolDefs'
import { centerOf, type Vec } from '../types'
import type { World } from '../world'
import { bodyAt, bodyInOpen, followBody } from './bodies'
import { CARRY } from './tuning'

/**
 * Bodies over the shoulder. G (pressed, not held) picks up the nearest body or tied man in reach and drops him again;
 * T throws him (off a ledge, down a shaft). While carrying, the player walks, cannot run, and has one hand for the pistol.
 * A man killed with a blade leaves a short trail of blood drops.
 */

const ONE_HANDED = toolIndex('pistol')

/** The nearest body (or tied man) lying in reach, if any. */
export function bodyInReach(world: World): number | null {
  const player = world.player
  const center = centerOf(player)
  const feet = player.y + player.h
  let best: number | null = null
  let bestGap = CARRY.reach
  world.guards.forEach((guard, index) => {
    const tied = guard.restrained && guard.mode !== 'dead'
    if (!tied && !bodyInOpen(world, guard)) return
    if (guard.hiddenIn !== null) return
    const at = tied && !guard.ragdoll ? { x: guard.x + guard.w / 2, y: guard.y + guard.h - 0.3 } : bodyAt(guard)
    if (Math.abs(at.y - feet) > 1.3) return
    const gap = Math.abs(at.x - center.x)
    if (gap >= bestGap) return
    best = index
    bestGap = gap
  })
  return best
}

export function pickUp(world: World, index: number): void {
  const guard = world.guards[index]
  // A man tied up while awake is hauled like the rest: he hangs limp over the shoulder.
  if (!guard.ragdoll) {
    guard.out = true
    guard.stunSeconds = Math.max(guard.stunSeconds, 1)
    guard.ragdoll = createRagdoll({ x: guard.x + guard.w / 2, y: guard.y + guard.h }, { x: 0, y: 0 }, world.rng)
  }
  world.stealth.carried = index
  world.stealth.lastDrop = centerOf(world.player)
  world.player.tool = ONE_HANDED
  world.player.reload = 0
}

/** Lets the body go where the player stands, with the player's way of moving (so dropping over a hole drops it down). */
export function putDown(world: World, speed: Vec = { x: world.player.vx * 0.5, y: 0 }): void {
  const index = world.stealth.carried
  if (index === null) return
  world.stealth.carried = null
  const guard = world.guards[index]
  if (!guard.ragdoll) return
  for (const point of guard.ragdoll.points) {
    point.vx = speed.x
    point.vy = speed.y
  }
  guard.ragdoll.sleep = null
  guard.ragdoll.still = 0
}

export function throwBody(world: World): void {
  const facing = world.player.facing
  putDown(world, { x: facing * CARRY.throwSpeed, y: -CARRY.throwLift })
}

/** Every frame while carrying: the walking pace, one hand, the body draped over the shoulder, and any blood. */
export function stepCarry(world: World, dt: number): void {
  const index = world.stealth.carried
  if (index === null) return
  const guard = world.guards[index]
  if (!guard.ragdoll || guard.hiddenIn !== null) {
    world.stealth.carried = null
    return
  }
  capPlayerSpeed(world, CARRY.speed, dt)
  if (TOOLS[world.player.tool].id !== 'pistol') world.player.tool = ONE_HANDED
  drape(world, guard)
  followBody(guard)
  bleed(world, index)
}

/** The joints over the shoulder: hips on the shoulder, torso hanging down the back, legs down the front. */
function drape(world: World, guard: Guard): void {
  const player = world.player
  const facing = player.facing
  const shoulder = { x: player.x + player.w / 2 + facing * 0.05, y: player.y + 0.32 }
  const hip = shoulder
  const at = (dx: number, dy: number): Vec => ({ x: hip.x + dx * facing, y: hip.y + dy })
  const joints = [
    at(-0.45, 0.78), at(-0.36, 0.52), at(0, -0.02),
    at(-0.42, 0.8), at(-0.4, 1.02), at(-0.3, 0.78), at(-0.28, 1),
    at(0.3, 0.12), at(0.36, 0.56), at(0.24, 0.16), at(0.3, 0.6),
  ]
  // Against a wall the hanging torso would poke into it; keep the body on the player's side instead.
  const shift = boxHitsSolid(world.grid, { x: joints[0].x - 0.1, y: joints[0].y - 0.1, w: 0.2, h: 0.2 }) ? facing * 0.3 : 0
  guard.ragdoll!.points.forEach((point, joint) => {
    point.x = joints[joint].x + shift
    point.y = joints[joint].y
    point.vx = 0
    point.vy = 0
  })
  guard.ragdoll!.sleep = null
}

function bleed(world: World, index: number): void {
  const stealth = world.stealth
  const left = stealth.bleeding.get(index) ?? 0
  if (left <= 0) return
  const here = centerOf(world.player)
  const last = stealth.lastDrop
  if (last && Math.abs(here.x - last.x) < CARRY.dropEvery && Math.abs(here.y - last.y) < 2) return
  stealth.lastDrop = here
  stealth.bleeding.set(index, left - 1)
  stealth.blood.push({ x: here.x, y: world.player.y + world.player.h, noticed: false })
}
